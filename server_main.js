const express = require('express')
const bodyParse = require('body-parser')
const bcrypt = require('bcrypt')
const path = require('path')
const app = express()
const adstripe = require('./afterdark_stripe')

const mysql = require('mysql');
var db = require('./database')

const fs = require('fs');


const EXPIRY_PERIOD = 3600 * 24 * 2; //24 hours
const SALT_ROUNDS = 9;


// var con = db.Connect();
const DB = db.ConnectWithDriver();

//#region express
app.use((request, response, next) => {
    //console.log(request.headers)
    next()
})

app.use(bodyParse.json())
app.use(bodyParse.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, "public")))
app.use('/scripts', express.static(__dirname + '/node_modules'));
//#endregion

// Handles request to root only.
app.get('/', (req, res) => {
    res.status(200);
    res.type('text/html');
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

//#region Get Generic Data 
//query functions
app.get('/GetBarNames', async (req, res) => {
    try {        
        var barsResult = await DB.getRecords('bars_info'); 
        // var barsResult = await db.Query("SELECT * FROM bars_info");        
        Output(true, barsResult, res);
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

app.get('/GetImageForBar/:id', (req, res) => {
    var id = req.params.id;

    if (id == undefined) {
        Output(false, "No bar id specified", res);
    }

    var imagePath = path.resolve(__dirname, "bar_images/" + id + "/0.jpg");

    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    }
    else {
        Output(false, `image does not exist for this id ${id}`, res);
    }
});

//#endregion
//action functions
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

        if (!correctPass) {
            throw "Invalid Password"
        }

        console.log(`USER LOGGED IN: ${username}`);

        let userData = userDataResults[0]
        userData.password = undefined
        Output(true, userData, res);
    }
    catch (err) {
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

            await DB.insertRecord('users', {email : email,gender : gender, age : age})
            let newUserData = await DB.getRecord('users',{email : email});         
            await DB.insertRecord('facebook_users',{id : id,afterdark_id: newUserData.id, email : email, name : name, age : age, gender : gender, date_begin : dateBegin})                        
            console.log('Facebook User Created')

            Output(true,newUserData, res);
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

        try 
        {
            await DB.insertRecord('stripe_customers',{afterdark_id : ad_userid, stripe_customer_id: customer.id})
        }
        catch(e)
        {
            Output(false,e,res)
        }        
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
        let usernameRecords = await DB.getRecord('users',{username : username})

        if(usernameRecords === undefined)
        {
            let emails = await DB.getRecord('users',{email : email})
            let emailsFB = await DB.getRecord('facebook_users',{email : email})

            if(emails === undefined && emailsFB === undefined)
            {
                console.log('signing up new user');
                console.log({username : username, password : password, email : email,gender : gender, age : age})
                await DB.insertRecord('users',{username : username, password : password, email : email,gender : gender, age : age, date_begin : dateBegin})
                let userData = await DB.getRecord('users',{username : username})
                userData.password = undefined
                Output(true,userData,res)
            }
            else
            {
                Output(false,'Email already exists',res)
            }
        }
        else
        {
            Output(false,'Username already taken',res)
        }
    }
    catch(e)
    {
        console.log(e)
        Output(false,e,res)
    }
})


//Legacy
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

app.listen(8080)

function Output(success, message, res) {
    var response = { success: success, output: message };
    res.status(200);
    res.send(response);
}