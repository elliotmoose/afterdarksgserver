const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const express = require('express');
const app = express.Router();

const db = require('./database')
const DB = db.ConnectWithDriver();

const adstripe = require('./afterdark_stripe');
const jwt = require('jsonwebtoken');
const bodyParse = require('body-parser');
app.use(bodyParse.json());
app.use(bodyParse.urlencoded({ extended: false }));

const JWT_SECRET = 'gskradretfa'
const EXPIRY_PERIOD = 3600 * 24 * 2; //24 hours
const SALT_ROUNDS = 10;

// Handles request to root only.
app.get('/', (req, res) => {
    res.status(200);
    res.type('text/html');
    res.sendFile(path.resolve(__dirname, 'index.html'));
});



//#region Get Generic Data 
app.get('/GetMerchants', async (req, res) => {
    try {        
        var merchantsResult = await DB.getRecords('merchants'); 
        Output(true, merchantsResult, res);
    }
    catch (err) {
        Output(false, err, res);
    }
});

app.get('/GetDiscounts', async (req, res) => {
    try {
        var discountsResult = await DB.getRecords('discounts'); 
        Output(true, discountsResult, res);
    }
    catch (err) {
        Output(false, err, res);
    }
});

app.get('/GetEvents', async (req, res) => {
    try {        
        //get events linked to merchant
        // let events = await DB.getRecords('events',{merchant_id: merchant_id});
        let events = await DB.getRecords('events');
        
        //get ticket_meta s linked to event
        for(let event of events)
        {        
            let tickets = await DB.getRecords('tickets_meta',{event_id : event.id});
            event.tickets = tickets;

            for(let ticket of tickets)
            {
                let available = await DB.query('SELECT COUNT(*) FROM tickets WHERE meta_id=? AND status=\'available\'',[ticket.id]);
                let total = await DB.query('SELECT COUNT(*) FROM tickets WHERE meta_id=?',[ticket.id]);

                if(available.length === 0 || total.length === 0)
                {
                    ticket.count = 0 
                    ticket.total = 0 
                }
                else
                {
                    ticket.count = available[0]["COUNT(*)"];
                    ticket.total = total[0]["COUNT(*)"];
                }
            }
        }

        Output(true, events, res);
    }
    catch (err) {
        Output(false, err, res);
    }
});

app.get('/GetImageForMerchant/:id', (req, res) => {
    var id = req.params.id;

    if (id == undefined) {
        Output(false, "No merchant id specified", res);
    }

    var imagePath = path.resolve(__dirname, "merchant_images/" + id + "/0.jpg");

    if (fs.existsSync(imagePath)) {
        // console.log(`image for: ${id}`)
        res.sendFile(imagePath);
    }
    else {
        // console.log(`no image for: ${id}`)
        Output(false, `image does not exist for this id ${id}`, res);
    }
});

//#endregion

//#region User creation and Authentication
app.post('/Login', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    try {       
        var userDataResults = await DB.getRecords('users',{username : username}); 
        if (userDataResults.length == 0) //username doesnt exist
        {
            throw "Invalid Username"
        }

        var correctPass = await bcrypt.compare(password, userDataResults[0].password)

        // console.log(password);
        // console.log(userDataResults[0].password)

        // console.log(correctPass)

        if (!correctPass) {
            throw "Invalid Password"
        }

        console.log(`USER LOGGED IN: ${username}`);

        let userData = userDataResults[0]
        userData.password = undefined

        let token = await jwt.sign({id: userData.id, email: userData.email},JWT_SECRET);
        userData.token = token;
        Output(true, userData, res);
    }
    catch (err) {
        console.log(err);
        Output(false, err, res);
    }
})

app.post('/FacebookLogin', async (req, res) => {
    var id = req.body.id;
    var email = req.body.email;
    var name = req.body.name;
    var age = req.body.age;
    var gender = req.body.gender;
    var dateBegin = Math.round(new Date().getTime() / 1000);

    try {
        var userResult = await DB.getRecord('facebook_users',{id : id});         
        
        if (userResult !== undefined) //User exists, logging in
        {
            let existingADUser = await DB.getRecord('users',{email : email})
            if(userResult.email != email) //user has id, but email mismatches with fb db. meaning user changed email
            {
                //we then want to help user update. but we need to also check if the email has been used to create another afterdark user account
                
                if(existingADUser !== undefined) //there exists a user with that email already
                {
                    Output(false, 'It seems your Facebook email has changed. The new email has already been used to create an Afterdark account.',res)
                    return
                }
                else
                {
                    await DB.updateRecords('facebook_users',{email : email},{id : id})                
                    console.log(`Updating email from ${userResult.email} to ${email}`)                
                }                
            }

            console.log('Facebook User Logged In')
            let token = await jwt.sign({id: existingADUser.id, email: existingADUser.email},JWT_SECRET);
            existingADUser.token = token;
            Output(true, existingADUser, res);
        }
        else //User does not exist, generate an account
        {   
            let userWithSameEmail = await DB.getRecord('users',{email: email})

            if(userWithSameEmail !== undefined)
            {
                Output(false,"Your Facebook email has already been used to create an account",res)
                return
            }

            await DB.insertRecord('users', {email : email,gender : gender, age : age, date_begin : dateBegin})
            let newUserData = await DB.getRecord('users',{email : email});         
            await DB.insertRecord('facebook_users',{id : id,afterdark_id: newUserData.id, email : email, name : name, age : age, gender : gender, date_begin : dateBegin})                        
            console.log('Facebook User Created')

            let token = await jwt.sign({id: newUserData.id, email: newUserData.email},JWT_SECRET);
            newUserData.token = token;
            Output(true, newUserData, res);
        }        
    }
    catch (err) {
        console.log(err)
        Output(false, err, res);
    }
})

app.post('/RetrieveCustomer',  async (req,res) => {
    let ad_userid = req.body.id;
    let token = req.body.token;
    let email = req.body.email;

    try
    {
        CheckRequiredFields({ad_userid,token,email});

        //step 1: check if user has a customer
        let ad_customer = await DB.getRecord('stripe_customers',{afterdark_id : ad_userid})

        //step 2a: if has, return customer id
        if(ad_customer !== undefined)
        {
            let customer_id = ad_customer.stripe_customer_id;
            Output(true, customer_id, res);
        }
        else //step 2b: if not, create customer
        {
            let customer = await adstripe.createCustomer(email, token);        
            await DB.insertRecord('stripe_customers',{afterdark_id : ad_userid, stripe_customer_id: customer.id}) 
        }    
    } 
    catch(error)
    {
        Output(false,error,res)
    }
})

app.post('/Register', async (req,res) => {
    let username = req.body.username
    let password = req.body.password
    let email = req.body.email
    let gender = req.body.gender == "male" ? 1 : req.body.gender == "female" ? 2 : undefined
    let age = req.body.age
    let dateBegin = Math.round(new Date().getTime() / 1000);
    
    try 
    {        
        CheckRequiredFields({username,password,email});
        let usernameRecords = await DB.getRecord('users',{username : username})

        if(usernameRecords === undefined)
        {
            let emails = await DB.getRecord('users',{email : email})
            let emailsFB = await DB.getRecord('facebook_users',{email : email})

            if(emails === undefined && emailsFB === undefined)
            {
                console.log(`New user: ${username} - ${email}`);
                // console.log({username : username, password : password, email : email,gender : gender, age : age})
                await DB.insertRecord('users',{username : username, password : password, email : email,gender : gender, age : age, date_begin : dateBegin})
                let userData = await DB.getRecord('users',{username : username})
                userData.password = undefined                
                let token = await jwt.sign({id: userData.id, email: userData.email},JWT_SECRET);
                userData.token = token;
                Output(true,userData,res)
            }
            else
            {
                throw 'Email already exists';
            }
        }
        else
        {
            throw 'Username already taken';
        }
    }
    catch(e)
    {
        console.log(e)
        Output(false,e,res)
    }
})

//#endregion

//#region event/ticket management
app.post('/CreateTicket', async (req,res) => {
    let name = req.body.name;
    let description = req.body.description;
    let count = req.body.count;
    let price = req.body.price;
    let event_id = req.body.event_id;
    let dateCreated = Math.round(new Date().getTime() / 1000);    

    try     
    {
        CheckRequiredFields({
            name : name,
            description : description,
            count : count,
            price : price,
            event_id : event_id,
        })

        let checkEvent = await DB.getRecord('events',{id : event_id})

        if(checkEvent === undefined)
        {
            throw 'The event you are trying to create a ticket for does not exist';
        }

        let ticket_meta = await DB.insertRecord('tickets_meta',{
            name : name,
            description : description,
            event_id : event_id,
            date_created : dateCreated
        });

        let meta_id = ticket_meta.insertId;
        for(let i=0;i<count;i++)
        {
            await DB.insertRecord('tickets',
            {
                name : name,
                description : description,
                meta_id: meta_id,
                price : price,
                status : 'available',
                date_created : dateCreated
            })
        }

        Output(true,ticket_meta,res)
    }
    catch(error)
    {
        console.log(error)
        Output(false,error,res)
    }
})

app.post('/DeleteEvent', async (req,res) => {    
    let event_id = req.body.event_id;

    try 
    {
        let getEvent = await DB.getRecord('events',{id : event_id});
    
        if(getEvent === undefined)
        {
            throw "The event does not exist";
        }

        let metas = await DB.getRecords('tickets_meta',{event_id : event_id});

        if(metas.length !== 0)
        {
            for(let meta of metas)
            {
                await DB.deleteRecords('tickets',{meta_id : meta.id});
            }
        }

        await DB.deleteRecords('tickets_meta',{event_id : event_id});
        await DB.deleteRecords('events',{id : event_id});

        Output(true,'Deleted',res);
    }
    catch(err)
    {
        console.log(err)
        Output(false,err,res)
    }
})

app.post('/DeleteTicket', async (req,res)=>{
    
    let ticket_meta_id = req.body.meta_id;
    try 
    {
        await DB.deleteRecords('tickets_meta',{id : ticket_meta_id})
        await DB.deleteRecords('tickets',{meta_id : ticket_meta_id})
        Output(true,'Deleted',res)
    }
    catch(err)
    {
        console.log(err)
        Output(false,err,res)
    }
})

app.post('/CreateEvent', async (req,res) => {
    let name = req.body.name;
    let merchant_id = req.body.merchant_id;
    let location = req.body.location;
    let date = req.body.date;
    let time = req.body.time;
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try 
    {
        let merchant = await DB.getRecord('merchants',{id : merchant_id})
        
        if(merchant === undefined)
        {
            throw "Merchant does not exist"
        }

        let output = await DB.insertRecord('events',{name : name,merchant_id : merchant_id,location : location, time: time, date : date, created: dateCreated})        
        Output(true,output,res)
    }
    catch(error)
    {
        console.log(error)
        Output(false,error,res)
    }
})

//#endregion

app.post('/AllocateTicket', async (req,res) => {
    let owner_id = req.body.owner_id;
    let ticket_meta_id = req.body.ticket_meta_id;
    let transaction_token = req.body.transaction_token;

    try 
    {
        //check owner exists
        let user = await DB.getRecord('users',{id : owner_id});

        if(user === undefined)
        {
            throw 'User does not exist';
        }

        //check ticket availability
        let tickets = await DB.getRecords('tickets',{meta_id : ticket_meta_id, status : 'available'})

        if(tickets.length === 0)
        {
            throw 'There are no more such tickets available';
        }

        //allocate ticket 
        let output = await DB.updateRecords('tickets',{status : 'allocated', owner_id : owner_id},{id : tickets[0].id})
        
        if(output !== undefined)
        {
            Output(true,output,res)
        }
        else
        {
            throw 'Allocation failed at updating ticket owner';
        }
    }
    catch(error)
    {
        console.log(error)
        Output(false,error,res)
    }

    
})

//#region stripe related 
app.post('/AddPaymentMethod', verifyToken, async (req,res)=>{
    let user_id = req.user_id;
    let card_token = req.body.token;
    
    //find out if user is already a stripe customer
    try 
    {
        CheckRequiredFields({card_token: card_token, user_id: user_id});

        let customer = await DB.getRecord('stripe_customers',{afterdark_id : user_id})
        if(customer === undefined)
        {
            console.log('Creating new customer...')
            //create customer
            let user = await DB.getRecord('users',{id: user_id})

            
            if(user === undefined || user.email === undefined || user.email === null)
            {
                console.log(`no user with id ${user_id}`)
                throw 'User does not exist'
            }

            let customer = await adstripe.createCustomer(user.email,card_token);
            let newCustomerResponse = await DB.insertRecord('stripe_customers',{afterdark_id: user_id, stripe_customer_id: customer.id})
            let stripe_customer_data = await adstripe.retrieveCustomer(customer.id);
            Output(true,stripe_customer_data,res);
        }
        else
        {
            console.log('Adding source to customer...')
            //add source
            let cus_token = customer.stripe_customer_id;

            if(cus_token === undefined || cus_token === null)
            {
                throw 'Database inconsistency: the stripe customer cannot be found. Please contact support'
            }

            let response = await adstripe.addSourceToCustomer(cus_token,card_token);
            let stripe_customer_data = await adstripe.retrieveCustomer(cus_token);
            Output(true, stripe_customer_data,res);
        }
    }
    catch(error)
    {
        console.log(error);
        Output(false,error,res);
    }    
})

app.post('/RemovePaymentMethod', verifyToken, async (req,res)=>{
    let user_id = req.user_id;
    let card_id = req.body.card_id;
    
    //find out if user is already a stripe customer
    try 
    {
        CheckRequiredFields({card_id: card_id, user_id: user_id});

        let customer = await DB.getRecord('stripe_customers',{afterdark_id : user_id})
        let user = await DB.getRecord('users',{id: user_id})
        
        if(customer === undefined || user === undefined || user.email === undefined || user.email === null)
        {
            console.log(`no user with id ${user_id}`)
            throw 'User does not exist'
        }

        let cus_id = customer.stripe_customer_id;

        let response = await adstripe.removeSourceFromCustomer(cus_id,card_id);
        let stripe_customer_data = await adstripe.retrieveCustomer(customer.stripe_customer_id);
        Output(true, stripe_customer_data,res);        
    }
    catch(error)
    {
        console.log(error);
        Output(false,error,res);
    }    
})

app.post('/MakeDefaultPaymentMethod', verifyToken, async (req,res)=>{
    let user_id = req.user_id;
    let card_id = req.body.card_id;    

    //find out if user is already a stripe customer
    try 
    {
        CheckRequiredFields({card_id: card_id, user_id: user_id});

        let customer = await DB.getRecord('stripe_customers',{afterdark_id : user_id})
        let user = await DB.getRecord('users',{id: user_id})
        
        if(customer === undefined || user === undefined || user.email === undefined || user.email === null)
        {
            console.log(`no user with id ${user_id}`)
            throw 'User does not exist'
        }

        let cus_id = customer.stripe_customer_id;

        let response = await adstripe.makeDefaultSource(cus_id,card_id);
        let stripe_customer_data = await adstripe.retrieveCustomer(customer.stripe_customer_id);
        Output(true, stripe_customer_data,res);        
    }
    catch(error)
    {
        console.log(error);
        Output(false,error,res);
    }    
})

app.post('/RetrieveStripeCustomer',verifyToken,  async (req,res) => {    
    let user_id = req.user_id;

    try 
    {
        CheckRequiredFields({user_id : user_id});
        let user = await DB.getRecord('stripe_customers',{afterdark_id: user_id})
        
        if(user === undefined)
        {
            throw 'User is not a stripe customer'
        }

        let customer = await adstripe.retrieveCustomer(user.stripe_customer_id);
        Output(true,customer,res);
    }
    catch(error)
    {
        console.log(error)
        Output(false,error,res);
    }    
})

async function verifyToken(req,res,next)
{
    let token = req.headers.authorization;
    if(token === undefined)
    {
        Output(false,'Missing authorization token',res)
        return
    }

    try 
    {
        let token_body = await jwt.verify(token, JWT_SECRET);
        req.user_id = token_body.id;
        req.email = token_body.email;
    }
    catch(error)
    {
        Output(false,'Authorization Token Invalid',res);
    }

    next();
}

//#endregion

//Legacy
app.post('/RegisterUser', async (req, res) => {
    var id = req.body.uuid;
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;

    if (id == undefined) {
        Output(false, "No uuid specified", res);
        return;
    }
    else if (username == undefined || password == undefined || email == undefined) {
        Output(false, "Invalid Register Information", res);
        return;
    }
    else {
        // var checkUsernameAvailableQueryString = `SELECT username FROM users WHERE username=\"${username}\"`;
        var username_check = await DB.getRecords('users',{username : username}); 
        // var username_check = await db.Query(checkUsernameAvailableQueryString);

        if (username_check.length != 0) {
            Output(false, "Username already taken", res);
            return
        }

        var userPersonalizedQueryString = `SELECT personalized FROM users WHERE uuid=\"${id}\"`;
        var usersPersonalizedResults = await db.Query(userPersonalizedQueryString)

        var hashed_password = await bcrypt.hash(password, SALT_ROUNDS);
        var dateBegin = Math.round(new Date().getTime() / 1000);

        try {
            if (usersPersonalizedResults.length == 0 || usersPersonalizedResults[0].personalized == true) //if this uuid hasnt been registered / if it has been created on this device before
            {
                var insertAccountQueryString = `INSERT INTO users (id,uuid,username,password,email,personalized,wallet,date_begin) VALUES (0,'${id}','${username}','${hashed_password}','${email}',0,'[]',${dateBegin})`;
                var insertResults = await db.Query(insertAccountQueryString)
                Output(true, insertResults, res);
            }
            else {
                var updateAccountsQueryString = `UPDATE users SET username=\"${username}\", password=\"${hashed_password}\",email=\"${email}\", personalized=1 WHERE uuid=\"${id}\"`;
                var updateResults = await db.Query(updateAccountsQueryString)
                Output(true, updateResults, res);
            }
        }
        catch (err) {
            console.log(`Register User Error: ${err}`)
            Output(false, err, res);
            return
        }
    }
})

app.post('/GenerateUser', (req, res) => {
    var id = req.body.uuid;

    if (id == undefined) {
        Output(false, "No uuid specified", res);
        return;
    }
    else {
        var dateBegin = Math.round(new Date().getTime() / 1000);
        var queryString = `INSERT INTO users (id,uuid,username,password,email,personalized,wallet,date_begin) VALUES (0,'${id}','','','',0,'[]',${dateBegin})`;

        db.Query(queryString).then(function (data) {
            Output(true, data, res);
        }).catch(function (err) {
            Output(false, err, res);
        });
    }
});

app.post('/RetrieveUser', async (req, res) => {
    var id = req.body.uuid;
    if (id == undefined) {
        Output(false, "No uuid specified", res);
        return;
    }
    else {        
        var results = await DB.getRecords('users',{uuid:id}); 
        Output(true, results, res);
    }
});

app.post('/AddDiscountToWalletForUser', (req, res) => {

    var user_id = parseInt(req.body.user_id);
    var discount_id = parseInt(req.body.discount_id);

    if (user_id == undefined || discount_id == undefined) {
        Output(false, "No id specified", res);
        return;
    }
    else {
        var queryWallet = `SELECT wallet FROM users WHERE id='${user_id}'`;
        db.Query(queryWallet).then(function (data) {

            if (data == []) {
                Output(false, "Hmm.. There seems to be an error,res");
                return;
            }


            let wallet = JSON.parse(data[0].wallet);

            //check if wallet exists
            if (wallet == undefined) { Output(false, `Wallet does not exist with user id: ${user_id}`, res); return; }

            //check if discount already added
            var isDiscountPresent = false;
            wallet.forEach(discount => {
                if (discount.id == discount_id) {
                    isDiscountPresent = true;
                }
            });

            if (isDiscountPresent) {
                Output(false, "Discount already in wallet", res);
                return;
            }

            //check if wallet is full
            if (wallet.length == 4) {
                Output(false, "Your wallet is full!", res);
                return;
            }

            //check if discount has run out
            var discountQueryString = `SELECT curAvailCount FROM discounts WHERE id=${discount_id}`;
            db.Query(discountQueryString).then(function (data) {

                var curAvailCount = data[0].curAvailCount;

                if (curAvailCount == 0) {
                    Output(false, "Discount fully claimed", res);
                    return;
                }

                var expiry = Math.round(new Date().getTime() / 1000) + EXPIRY_PERIOD;
                var newDiscount = {
                    id: discount_id,
                    expiry: expiry
                };

                wallet.push(newDiscount);
                wallet = JSON.stringify(wallet);

                var updateWalletString = `UPDATE users SET wallet='${wallet}' WHERE id='${user_id}'`;
                db.Query(updateWalletString).then(function (data) { //update wallet
                    var reduceDiscountCounterString = `UPDATE discounts SET curAvailCount=${curAvailCount - 1} WHERE id='${discount_id}'`;
                    db.Query(reduceDiscountCounterString).then(function (data) { //set new counter
                        var getNewWalletString = `SELECT wallet FROM users WHERE id='${user_id}'`;
                        db.Query(getNewWalletString).then(function (data) { //get new wallet to return
                            let wallet = JSON.parse(data[0].wallet);
                            Output(true, wallet, res);
                            return;
                        });
                    });
                }).catch(function (err) {
                    Output(false, err, res);
                    return;
                });
            });
        });
    }
});

app.post('/AddDiscountClaim', (req, res) => {
    // var id = req.body.id;
    // var discount_id = req.body.discount_id;
    var user_id = parseInt(req.body.user_id);
    var discount_id = parseInt(req.body.discount_id);

    if (user_id == undefined || discount_id == undefined) {
        Output(false, "No id specified", res);
        return;
    }
    else {
        var queryWallet = `SELECT wallet FROM users WHERE id='${user_id}'`;
        db.Query(queryWallet).then(function (data) {

            let wallet = JSON.parse(data[0].wallet);

            //check if wallet exists
            if (wallet == undefined) { Output(false, `Wallet does not exist with user id: ${user_id}`, res); }

            var hasDiscount = false;
            //check if the discount exists
            wallet.forEach(discountObject => {
                if (discountObject.id == discount_id) {
                    hasDiscount = true;

                    wallet = JSON.stringify(wallet.filter(discount => discount.id != discount_id));
                    var epoch = Math.round(new Date().getTime() / 1000);

                    var discountClaimString = `INSERT INTO discount_claims (id,discount_id,user_id,date) values (0,${discount_id},${user_id},${epoch})`;
                    db.Query(discountClaimString).then(function (data) { //add discount claim
                        var updateWalletString = `UPDATE users SET wallet='${wallet}' WHERE id=${user_id}`;
                        db.Query(updateWalletString).then(function (data) { //update wallet            
                            var getNewWalletString = `SELECT wallet FROM users WHERE id='${user_id}'`;
                            db.Query(getNewWalletString).then(function (data) { //get new wallet to return
                                let wallet = JSON.parse(data[0].wallet);
                                Output(true, wallet, res);
                                return;
                            });
                        }).catch(function (err) {
                            Output(false, err, res);
                            return;
                        });

                    }).catch(function (err) {
                        Output(false, err, res);
                        return;
                    });
                }
            });

            if (hasDiscount == false) {
                Output(false, "User does not have this discount", res);
                return;
            }
        });
    }
});

app.post('/GetWalletForUser', (req, res) => {
    var id = req.body.id;
    if (id == undefined) {
        Output(false, "No id specified", res);
        return;
    }
    else {
        //check whether any of the discounts have expired 
        //if expired, remove

        var walletOutput;
        db.Query("SELECT wallet FROM users WHERE id='" + id + "'").then(function (walletData) {
            walletOutput = JSON.parse(walletData[0].wallet);

            var wallet = walletOutput.filter(CheckDiscountHasExpired);

            // wallet.forEach(discount => {
            //   console.log(epoch-discount.dateBegin>(60*60*24*3));
            // })
            // console.log("wallet:" + wallet);

            var query = `UPDATE users SET wallet='${JSON.stringify(wallet)}' WHERE id=${id}`;
            db.Query(query).then(function (data) {
                Output(true, wallet, res);
                return;
            });
        }).catch(function (err) {

            Output(false, err, res);
        });
    }
});

function CheckDiscountHasExpired(discount) {
    var epoch = Math.round(new Date().getTime() / 1000);
    return (epoch - discount.expiry) < 3600 * 24 * 2;
}

function Output(success, message, res) {
    var response = { success: success, output: message };
    res.status(200);
    res.send(response);
}

function CheckRequiredFields(object)
{
    for(var key in object)
    {
        if(object[key] === undefined || object[key] === null)
        {
            throw `Required value missing: ${key}`
        }
    }
}

module.exports = app;