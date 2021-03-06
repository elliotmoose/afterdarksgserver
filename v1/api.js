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

const config = require('../config');
const strings = require('./strings');

const JWT_SECRET = 'gskradretfa'
const TICKET_SECRET = 'gskradretfa'
const CONSOLE_SECRET = 'gskradretfa'
// const EXPIRY_PERIOD = 3600 * 24 * 2; //24 hours
const EXPIRY_PERIOD = 3600 * 24 * 7; //7 days
// const EXPIRY_PERIOD = 15; //24 hours
const SALT_ROUNDS = 10;



app.get('/', (req, res) => {
    res.status(200);    
    res.send({
        version: 'v1',
        config: {
            live: config.live,
            remote: config.remote,
            domain : config.domain            
        }
    })
});

//#region console
app.get('/console/logs', (req,res)=>{
    var logsPath = path.resolve("/home/elliotmoose/.forever/serverlogs.log");

    if (fs.existsSync(logsPath)) {
        // console.log(`image for: ${id}`)
        res.sendFile(logsPath);
    }
    else {
        // console.log(`no image for: ${id}`)
        res.status(404);
        res.send('No logs available')
    }
})


app.get('/console/config', (req,res)=>{
    
    res.json({
        live : config.live,
        remote : config.remote,
        https : config.https,
    })
})

app.get('/console/charges', verifyToken, async (req,res)=>{
    try {
        let charges = await DB.getRecords('charges');

        let response = []
        for(let charge of charges)
        {
            response.push({
                charge_id: charge.id,
                cus_id: charge.customer,            
                date : DateFormatPresentable(charge.date),
                description: charge.description
            })
        }
        Respond('RETRIEVED_CHARGES',response,res);
    } catch (error) {
        InternalServerError(res,error)
    }
})

app.get('/console/holders', async (req,res)=> {
    try {
        let request_discount_id = req.query.discount_id;
        let owned_discounts = await DB.getRecords('discounts', {meta_id:request_discount_id, status: 'allocated'});

        try {
            CheckRequiredFields({discount_id: request_discount_id});
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS, strings.MISSING_FIELDS.STATUSTEXT, error, res);
            return
        }

        var output = '';
        for(let discount of owned_discounts)
        {
            let owner = await DB.getRecord('users',{id:discount.owner_id});
            let userrow = ''
            if(owner.username == null)
            {
                let fb_owner = await DB.getRecord('facebook_users',{afterdark_id: discount.owner_id});                
                let gender = owner.gender == 1 ? 'Male' : owner.gender == 2 ? 'Female' : 'nil'
                let age = owner.age ? owner.age : 'nil';
                userrow = `${fb_owner.name} ${owner.email} ${age} ${gender} <br/>`;
                // output.push({
                //     name: fb_owner.name,
                //     email : owner.email,
                //     age: owner.age,
                //     gender: owner.gender,
                // })                     
            }
            else
            {
                let gender = owner.gender == 1 ? 'Male' : owner.gender == 2 ? 'Female' : 'nil'
                let age = owner.age ? owner.age : 'nil';
                
                userrow = `${owner.username}* ${owner.email} ${age} ${gender} <br/>`;                     
            }

            if(output.indexOf(userrow) == -1)
            {
                output += userrow;
            }
        }
                
        res.send(output);
        // Respond('SUCCESS', output,res);
    } catch (error) {
        InternalServerError(res,error);
    }
})

app.get('/console/ticket_claimants', async (req,res)=> {
    try {
        let request_ticket_meta_id = req.query.meta_id;
        
        try {
            CheckRequiredFields({discount_id: request_ticket_meta_id});
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS, strings.MISSING_FIELDS.STATUSTEXT, error, res);
            return
        }

        let claimed_tickets = await DB.getRecords('tickets', {meta_id:request_ticket_meta_id});

        var allocated_output = 'Unscanned Purchased Tickets: <br/>';
        var claimed_output = 'Scanned Tickets: <br/>';
        var consumed_count = 0;
        var allocated_count = 0;
        for(let ticket of claimed_tickets.filter((el)=>el.status == 'consumed' || el.status == 'allocated'))
        {            
            let owner = await DB.getRecord('users',{id:ticket.owner_id});

            if(owner === undefined)
            {
                continue;
            }

            let gender = owner.gender == 1 ? 'Male' : owner.gender == 2 ? 'Female' : 'nil'
            let age = owner.age ? owner.age : 'nil';            

            let name = owner.username + '*';
            if(owner.username == null)
            {
                let fb_owner = await DB.getRecord('facebook_users',{afterdark_id: ticket.owner_id});                                                
                name = fb_owner.name;                
            }

            if(ticket.status == 'consumed')
            {
                consumed_count += 1;        
                claimed_output += `${consumed_count}. id: ${ticket.id} ${name} ${gender} ${age}<br/>`;                                                         
            }
            else if (ticket.status == 'allocated')
            {
                allocated_count += 1;
                allocated_output += `${allocated_count}. id: ${ticket.id} ${name} ${gender} ${age}<br/>`;                                                         
            }
        }
                
        var output = allocated_output + '<br/>' + claimed_output;
        res.send(output);        
        // res.json(claimed_tickets);
        // Respond('SUCCESS', output,res);
    } catch (error) {
        InternalServerError(res,error);
    }
})

//#region event/ticket management
app.post('/console/CreateTicket', verifyToken, async (req, res) => {
    let name = req.body.name;
    let description = req.body.description;
    let count = req.body.count;
    let price = req.body.price;
    let event_id = req.body.event_id;
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try {
        try {
            CheckRequiredFields({ name: name, description: description, count: count, price: price, event_id: event_id, })            
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        let checkEvent = await DB.getRecord('events', { id: event_id })

        if (!checkEvent) {
            Error('EVENT_MISSING','Event Missing','The requested event does not exist.',res)
            return
        }

        let ticket_meta = await DB.insertRecord('tickets_meta', {
            name: name,
            description: description,
            event_id: event_id,
            price : price,
            date_created: dateCreated
        });

        let meta_id = ticket_meta.insertId;
        for (let i = 0; i < count; i++) {
            await DB.insertRecord('tickets',
                {
                    name: name,
                    description: description,
                    meta_id: meta_id,
                    price: price,
                    status: 'available',
                    date_created: dateCreated
                })
        }

        Respond('TICKET_CREATED',ticket_meta,res);
    }
    catch (error) {
        console.log(error);
        InternalServerError(res);
    }
})

app.post('/console/PopulateTicket', verifyToken, async (req,res) => {
    let merchant_user_id = req.user_id;
    let email = req.email;
    let ticket_meta_id = req.body.ticket_meta_id;
    let count = req.body.count;
    let dateCreated = Math.round(new Date().getTime() / 1000);    

    try {
        try {
            CheckRequiredFields({
                ticket_meta_id: ticket_meta_id,
                count: count
            })

            
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        //Checking if token is valid
        let merchant_user = await DB.getRecord('merchant_users',{id: merchant_user_id, email: email})
        
        if(!merchant_user)
        {
            Error('AUTHENTICATION_FAILED','Invalid User','The token you have provided is invalid',res);
            return
        }

        //check if ticket exists
        let ticket_meta = await DB.getRecord('tickets_meta',{id: ticket_meta_id});
        
        if(ticket_meta)
        {
            //get event => get event's merchant_id => compare to requesting token's merchant id
            let event = await DB.getRecord('events',{id: ticket_meta.event_id}) 
            if(!event || event.merchant_id != merchant_user.merchant_id)
            {
                Error('MERCHANT_MISMATCH','Merchant Mismatch','This event either does not exist, or does not belong to you',res)
                return
            } 

            let affectedRows = 0 
            for(let i=0;i<count;i++)
            {
                await DB.insertRecord('tickets',{
                    price: ticket_meta.price,
                    tx_fee : ticket_meta.tx_fee,
                    meta_id : ticket_meta.id,
                    status: 'available',
                    date_created: dateCreated
                })

                affectedRows += 1
            }
            
            Respond('TICKETS_POPULATED',{affectedRows: affectedRows},res);
        }
        else
        {
            Error('TICKET_MISSING','Missing Ticket', 'The requested ticket meta does not exist', res);
            return
        }
        
    } catch (error) {
        InternalServerError(res,error);
    }
})

app.post('/console/CullTicket', verifyToken, async (req,res) => {
    let merchant_user_id = req.user_id;
    let email = req.email;
    let ticket_meta_id = req.body.ticket_meta_id;
    let count = req.body.count;
    let dateCreated = Math.round(new Date().getTime() / 1000);    

    try {
        try {
            CheckRequiredFields({ ticket_meta_id: ticket_meta_id, count: count })
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }
        
        //Checking if token is valid
        let merchant_user = await DB.getRecord('merchant_users',{id: merchant_user_id, email: email})
        
        if(!merchant_user)
        {
            Error('AUTHENTICATION_FAILED','Invalid User','The token you have provided is invalid',res);
            return
        }

        //check if ticket exists
        let ticket_meta = await DB.getRecord('tickets_meta',{id: ticket_meta_id});
        
        if(ticket_meta)
        {
            //get event => get event's merchant_id => compare to requesting token's merchant id
            let event = await DB.getRecord('events',{id: ticket_meta.event_id}) 
            if(!event || event.merchant_id != merchant_user.merchant_id)
            {
                Error('MERCHANT_MISMATCH','Merchant Mismatch','This event either does not exist, or does not belong to you',res)
                return
            } 

            let current_tickets = await DB.getRecords('tickets',{meta_id: ticket_meta_id, status: 'available'})
            
            if(current_tickets.length < count)
            {
                Error('INSUFFICIENT_TICKETS', 'Insufficient Tickets', `There lesser number of available tickets than requested to cull (${current_tickets.length} left)`,res)
                return
            }

            let affectedRows = 0
            for(let i=0;i<count;i++)
            {
                let ticket_to_cull = current_tickets[i]
                await DB.deleteRecords('tickets',{id: ticket_to_cull.id, status: 'available'})
                affectedRows += 1
            }

            let remainding_tickets = await DB.getRecords('tickets',{meta_id: ticket_meta_id, status: 'available'})
            
            Respond('TICKETS_CULLED',{previousCount: current_tickets.length, currentCount: remainding_tickets.length},res);
        }
        else
        {
            Error('TICKET_MISSING','Missing Ticket', 'The requested ticket meta does not exist', res);
            return
        }
    } catch (error) {
        InternalServerError(res,error);
    }
})

app.post('/console/DeleteEvent', verifyToken, async (req, res) => {
    let event_id = req.body.event_id;

    try {
        let getEvent = await DB.getRecord('events', { id: event_id });

        if (!getEvent) {
            Error('EVENT_MISSING','Event Missing','The requested event does not exist',res);

        }

        let metas = await DB.getRecords('tickets_meta', { event_id: event_id });

        if (metas.length !== 0) {
            for (let meta of metas) {
                await DB.deleteRecords('tickets', { meta_id: meta.id });
            }
        }

        await DB.deleteRecords('tickets_meta', { event_id: event_id });
        await DB.deleteRecords('events', { id: event_id });
        Respond('EVENT_DELETED',{},res);
    }
    catch (err) {
        console.log(err);
        InternalServerError(res);
    }
})

app.post('/console/DeleteTicket', verifyToken, async (req, res) => {

    let ticket_meta_id = req.body.meta_id;
    try {
        await DB.deleteRecords('tickets_meta', { id: ticket_meta_id });
        await DB.deleteRecords('tickets', { meta_id: ticket_meta_id });
        Respond('TICKET_DELETED',{},res);
    }
    catch (err) {
        console.log(err);
        InternalServerError(res);
    }
})

app.post('/console/CreateEvent', verifyToken, async (req, res) => {
    let name = req.body.name;
    let merchant_id = req.body.merchant_id;
    let location = req.body.location;
    let date = req.body.date;
    let time = req.body.time;
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try {
        let merchant = await DB.getRecord('merchants', { id: merchant_id })

        if (!merchant) {
            Error('INVALID_FIELDS','Merchant Missing','The requested merchant does not exist.',res);
            return;
        }

        let response = await DB.insertRecord('events', { name: name, merchant_id: merchant_id, location: location, time: time, date: date, created: dateCreated });
        Respond('EVENT_CREATED', response, res);
    }
    catch (error) {
        console.log(error)
        InternalServerError(res);
    }
})



//#endregion


//#endregion

//#region get generic data 
app.get('/GetMerchants', async (req, res) => {
    try {
        var merchantsResult = await DB.getRecords('merchants');
        Respond('RETRIEVED_MERCHANTS',merchantsResult,res);
    }
    catch (err) {
        InternalServerError(res,err);
    }
});

app.get('/GetDiscounts', async (req, res) => {
    try {
        var discounts = await DB.getRecords('discounts_meta');

        for(let discount of discounts)
        {
            let available = await DB.query('SELECT COUNT(*) FROM discounts WHERE meta_id=? AND status=\'available\'', [discount.id]);
            let total = await DB.query('SELECT COUNT(*) FROM discounts WHERE meta_id=?', [discount.id]);

            if (available.length === 0 || total.length === 0) {
                discount.count = 0
                discount.total = 0
            }
            else {
                discount.count = available[0]["COUNT(*)"];
                discount.total = total[0]["COUNT(*)"];
            }
        }

        Respond('RETRIEVED_DISCOUNTS',discounts,res);
    }
    catch (err) {
        InternalServerError(res,err);
    }
});

app.get('/GetEvents', async (req, res) => {
    try {
        //get events linked to merchant
        // let events = await DB.getRecords('events',{merchant_id: merchant_id});
        let events = await DB.getRecords('events');

        //get ticket_meta s linked to event
        for (let event of events) {
            let tickets = await DB.getRecords('tickets_meta', { event_id: event.id });
            event.tickets = tickets;

            for (let ticket of tickets) {
                let available = await DB.query('SELECT COUNT(*) FROM tickets WHERE meta_id=? AND status=\'available\'', [ticket.id]);
                let total = await DB.query('SELECT COUNT(*) FROM tickets WHERE meta_id=?', [ticket.id]);

                if (available.length === 0 || total.length === 0) {
                    ticket.count = 0
                    ticket.total = 0
                }
                else {
                    ticket.count = available[0]["COUNT(*)"];
                    ticket.total = total[0]["COUNT(*)"];
                }
            }
        }

        Respond('RETRIEVED_EVENTS',events,res);
    }
    catch (err) {
        InternalServerError(res,err);
    }
});

app.get('/GetImageForMerchant/:id', (req, res) => {
    var id = req.params.id;

    if (id == undefined) {
        Output(false, "No merchant id specified", res);
    }

    var imagePath = path.resolve(__dirname, "../merchant_images/" + id + "/0.jpg");

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

//#region get user data
app.post('/GetWalletForUser', verifyToken, async (req, res) => {
    let now = Math.round(new Date().getTime() / 1000);
    let user_id = req.user_id;
    try {
        // let tickets = await DB.getRecords('tickets', { owner_id: user_id, status: 'allocated'});
        let tickets = await DB.getRecords('tickets', { owner_id: user_id});
        // let discounts = await DB.getRecords('discounts',{owner_id: user_id});

        let wallet = {
            tickets: [],
            discounts: []
        }

        for (let ticket of tickets) {

            let signature = await bcrypt.hash(`${TICKET_SECRET}${ticket.id}`,SALT_ROUNDS);
            ticket.signature = signature;

            let ticket_meta = await DB.getRecord('tickets_meta', { id: ticket.meta_id });
            if (ticket_meta) {
                let event = await DB.getRecord('events', { id: ticket_meta.event_id });

                if (event) {
                    let merchant = await DB.getRecord('merchants', { id: event.merchant_id })

                    if (merchant) {
                        ticket.meta = ticket_meta;
                        ticket.event = event;
                        ticket.merchant = merchant;
                        wallet.tickets.push(ticket);
                    }
                }
            }
        }

        let discounts = await DB.getRecords('discounts',{owner_id: user_id, status: 'allocated'})

        for(let discount of discounts)
        {
            //check for expiries
            if((now-discount.date_allocated) > EXPIRY_PERIOD)
            {
                await DB.updateRecords('discounts',{status: 'expired'},{id: discount.id})
                continue //dont include
            }
            let discount_meta = await DB.getRecord('discounts_meta',{id: discount.meta_id})
            if(!discount_meta) continue;
            discount.meta = discount_meta;
            discount.expiry = new Date((discount.date_allocated + EXPIRY_PERIOD)*1000).toLocaleString('en-US')
            wallet.discounts.push(discount)
        }

        Respond('RETRIEVED_WALLET',wallet,res);
    }
    catch (error) {
        InternalServerError(res,error);
    }
});

//#endregion

//#region user creation and authentication
app.post('/Login', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    try {
        var merchantData = await DB.getRecord('merchant_users',{username: username});
        
        if(merchantData != undefined)
        {
            let merchantPassIsCorrect = await bcrypt.compare(password, merchantData.password);
            if(!merchantPassIsCorrect)
            {
                Error('AUTHENTICATION_FAILED','Wrong Username/Password','The username/password is incorrect',res);
                return
            }

            console.log(`MERCHANT LOGGED IN: ${username}`);

            merchantData.password = undefined;
            merchantData.type = 'MERCHANT'
            let token = await jwt.sign({id: merchantData.id, email: merchantData.email}, JWT_SECRET);
            merchantData.token = token;
            Respond('LOGIN_SUCCESS',merchantData,res);
            return
        }


        var userData = await DB.getRecord('users', { username: username });
        if (userData === undefined) //username doesnt exist
        {
            Error('AUTHENTICATION_FAILED','Wrong Username/Password','The username/password is incorrect',res);
            return
        }

        var correctPass = await bcrypt.compare(password, userData.password)

        if (!correctPass) {
            Error('AUTHENTICATION_FAILED','Wrong Username/Password','The username/password is incorrect',res);
            return
        }

        userData.password = undefined
        userData.type = 'USER'
        let token = await jwt.sign({ id: userData.id, email: userData.email }, JWT_SECRET);
        userData.token = token;
        Respond('LOGIN_SUCCESS',userData,res);
    }
    catch (err) {
        console.log(err);
        InternalServerError(res)
    }
})

app.post('/FacebookLogin', async (req, res) => {

    try {
        
        var id = req.body.id;
        var email = req.body.email;
        var name = req.body.name;
        var age = req.body.age;
        var gender = req.body.gender;
        var dateBegin = Math.round(new Date().getTime() / 1000);

        try {
            if(!email)
            {
                Error(strings.MISSING_FIELDS.STATUS, strings.MISSING_FIELDS.STATUSTEXT,'It seems Facebook login has not provided your email. Please Signup to join Afterdark.',res)
                return
            }
            CheckRequiredFields({id: id, email : email, name: name })
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        var userResult = await DB.getRecord('facebook_users', { id: id });
        
        if (userResult !== undefined) //User exists, logging in
        {
            let existingADUser = await DB.getRecord('users', { email: email })
            let existingADMerchant = await DB.getRecord('merchant_users', { email: email })
            if (userResult.email != email) //user has id, but email mismatches with fb db. meaning user changed email
            {
                //we then want to help user update. but we need to also check if the email has been used to create another afterdark user account
                if (existingADUser || existingADMerchant) //there exists a user with that email already
                {
                    Error('REGISTRATION_CONFLICT','Email Changed','It seems your Facebook email has changed. The new email has already been used to create an Afterdark account.',res)
                    return
                }
                else {
                    await DB.updateRecords('facebook_users', { email: email }, { id: id })
                    console.log(`Updating email from ${userResult.email} to ${email}`)
                }
            }

            let token = await jwt.sign({ id: existingADUser.id, email: existingADUser.email }, JWT_SECRET);
            existingADUser.token = token;
            Respond('LOGIN_SUCCESS',existingADUser,res);
        }
        else //User does not exist, generate an account
        {
            let userWithSameEmail = await DB.getRecord('users', { email: email })

            if (userWithSameEmail !== undefined) {
                Error('REGISTRATION_CONFLICT','Email Taken','Your Facebook email has already been used to create an account',res)
                return
            }

            let insertData = { email: email, date_begin: dateBegin }
            gender && (insertData.gender = gender)
            age && (insertData.age = age)
            await DB.insertRecord('users', insertData)
            let newUserData = await DB.getRecord('users', { email: email });
            await DB.insertRecord('facebook_users', { id: id, afterdark_id: newUserData.id, email: email, name: name, age: age, gender: gender, date_begin: dateBegin })

            let token = await jwt.sign({ id: newUserData.id, email: newUserData.email }, JWT_SECRET);
            newUserData.token = token;
            Respond('LOGIN_SUCCESS',newUserData,res);
        }
    }
    catch (err) {
        console.log(err)
        InternalServerError(res)
    }
})

app.post('/SetAdditionalUserData', verifyToken, async (req,res) => {
    let user_id = req.user_id
    let gender = req.body.gender == "male" ? 1 : req.body.gender == "female" ? 2 : undefined
    let age = req.body.age

    try {
        try {
            CheckRequiredFields({
                gender : gender,
                age : age
            })
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        let response = await DB.updateRecords('users',{
            gender : gender,
            age: age
        }, {id: user_id})

        Respond('SUCCESS',{},res)
    } catch (error) {
        InternalServerError(res, error)
    }
})

app.post('/Register', async (req, res) => {
    let username = req.body.username
    let password = req.body.password
    let email = req.body.email
    let gender = req.body.gender == "male" ? 1 : req.body.gender == "female" ? 2 : undefined
    let age = req.body.age
    let dateBegin = Math.round(new Date().getTime() / 1000);

    try {
        try {            
            CheckRequiredFields({ username, password, email });
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }
        let usernameRecords = await DB.getRecord('users', { username: username });
        let merchantUsernameRecord = await DB.getRecord('merchant_users', { username: username }); //check against merchants in case        

        if (usernameRecords === undefined && merchantUsernameRecord === undefined) {
            let emails = await DB.getRecord('users', { email: email })
            let emailsFB = await DB.getRecord('facebook_users', { email: email })
            let merchantEmailRecord = await DB.getRecord('merchant_users', { email: email }) //check against merchants in case

            if (emails === undefined && emailsFB === undefined && merchantEmailRecord === undefined) {
                console.log(`New user: ${username} - ${email}`);
                // console.log({username : username, password : password, email : email,gender : gender, age : age})
                await DB.insertRecord('users', { username: username, password: password, email: email, gender: gender, age: age, date_begin: dateBegin })
                let userData = await DB.getRecord('users', { username: username })
                userData.password = undefined
                let token = await jwt.sign({ id: userData.id, email: userData.email }, JWT_SECRET);
                userData.token = token;
                Respond('REGISTER_SUCCESS',userData,res);
            }
            else {        
                Error(strings.EMAIL_TAKEN.STATUS,strings.EMAIL_TAKEN.STATUSTEXT, strings.EMAIL_TAKEN.MESSAGE,res);
                return 
            }
        }
        else {
            Error(strings.USERNAME_TAKEN.STATUS,strings.USERNAME_TAKEN.STATUSTEXT, strings.USERNAME_TAKEN.MESSAGE,res);
            return 
        }
    }
    catch (e) {
        console.log(e)
        InternalServerError(res);
    }
})

app.post('/console/RegisterMerchant', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let email = req.body.email;
    let merchant_id  = req.body.merchant_id;
    let dateBegin = Math.round(new Date().getTime() / 1000);
    let secret = req.body.secret

    try {
        try {            
            CheckRequiredFields({ username, password, email, merchant_id });
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        if(secret !== CONSOLE_SECRET)
        {
            Error('AUTHENTICATION_ERROR','Invalid secret','Invalid secret provided',res);
            return
        }

        let merchant_id_record = await DB.getRecord('merchant_users',{merchant_id : merchant_id});

        if(merchant_id_record)
        {
            Error('REGISTRATION_CONFLICT','Merchant Taken','The requested merchant already has a user account',res);
            return
        }

        let usernameRecord = await DB.getRecord('users', { username: username });        
        let merchantUsernameRecord = await DB.getRecord('merchant_users', { username: username }); //check against merchants in case                

        if (!usernameRecord && !merchantUsernameRecord) {
            let usersEmailRecord = await DB.getRecord('users', { email: email });
            let merchantEmailRecord = await DB.getRecord('merchant_users', {email: email}); //check against merchants in case        
            let facebookEmailRecord = await DB.getRecord('facebook_users', {email : email})

            if (!usersEmailRecord && !merchantEmailRecord && !facebookEmailRecord) {
                console.log(`NEW MERCHANT: ${username} - ${email} - Merchant_id:${merchant_id}`);
                let hashedPass = await bcrypt.hash(password, SALT_ROUNDS);
                await DB.insertRecord('merchant_users', { username: username, password: hashedPass, email: email, merchant_id: merchant_id, date_begin: dateBegin })
                let userData = await DB.getRecord('merchant_users', { username: username })
                userData.password = undefined
                let token = await jwt.sign({ id: userData.id, email: userData.email }, JWT_SECRET);
                userData.token = token;
                Respond('REGISTER_SUCCESS',userData,res);
            }
            else {        
                Error('REGISTRATION_CONFLICT','Email Taken', 'The email you have specificed has already been used.',res);
                return 
            }
        }
        else {
            Error('REGISTRATION_CONFLICT','Username Taken', 'The username you have specificed has already been used.',res);
            return 
        }
    }
    catch (e) {
        console.log(e)
        InternalServerError(res);
    }
})

//#endregion

//#region ticket purchase/verify
//to change in db:
//change ticket_id to ticket_ids, int to string
//add purchase limit in ticket meta
//purchase pricing now based off of meta pricing.
//remove tx_fee from meta and tickets
//add tx_fee_included
app.post('/PurchaseTicket', verifyToken, async (req, res) => {
    let owner_id = req.user_id;
    let ticket_meta_id = req.body.ticket_meta_id;    
    let transaction_token = req.body.transaction_token;
    let now = Math.round(new Date().getTime() / 1000);
    let count = req.body.count; //THIS VERSION SHOULD NOT SUPPORT COUNT

    Error('WRONG_VERSION', 'Outdated', 'Your app version is outdated. Please update the app before making purchases',res);
    return;
    
    try {
        try {
            CheckRequiredFields({ count, owner_id, ticket_meta_id });            
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        if(count !== undefined)
        {            
            //domain is wrong in app, but requests to purchase multiple tickets
            Error('WRONG_VERSION', 'Outdated', 'Your app version is outdated. Please update the app before making purchases',res);
            return;
        }
        //check owner exists
        try {
            var user = await DB.getRecord('users', { id: owner_id });
            ThrowWithMessageIfEmpty(user, 'User does not exist. Please login again.')
            var ticket_meta = await DB.getRecord('tickets_meta', { id: ticket_meta_id })
            ThrowWithMessageIfEmpty(ticket_meta, 'Ticket no longer exists')
            var event = await DB.getRecord('events', { id: ticket_meta.event_id })
            ThrowWithMessageIfEmpty(event, 'Event no longer exists')
            //check ticket availability
            var tickets = await DB.getRecords('tickets', { meta_id: ticket_meta_id, status: 'available' })
            ThrowWithMessageIfEmpty(tickets, 'These tickets are no longer available.')
            
            if(tickets.length < count)
            {
                Error('INSUFFICIENT_TICKETS','Not Enough Tickets', `There are only ${tickets.length} tickets left.`, res);
                return;
            }

            if(ticket_meta.purchase_limit !== null && ticket_meta.purchase_limit < count)
            {
                Error('LIMIT_EXCEEDED','Limit Exceeded', `You can only purchase a maximum of ${ticket_meta.purchase_limit} tickets at one time`, res);
                return;
            }

            var tickets_to_purchase = [];
            var ticket_ids = [];
            var ticket_chargeable = 0;

            for(let i=0;i< count; i++)
            {
                let ticket = tickets[i];
                
                if(ticket !== undefined)
                {
                    tickets_to_purchase.push(ticket);
                    ticket_ids.push(ticket.id);
                    //NOTE - price comes from ticket
                    ticket_chargeable += ticket_meta.price;
                }
            }

            if(ticket_chargeable != 0)
            {
                //purchase
                // - get stripe customer from adUser_id
                // - create charge for this customer
                // - on success, allocate ticket
                var customer = await DB.getRecord('stripe_customers', { afterdark_id: owner_id });
                ThrowWithMessageIfEmpty(customer, 'User is not a stripe customer.  Please login again.');            
            }
        } catch (error) {
            Error('INVALID_FIELDS','Invalid Request',error,res);
            return;
        }

        
        //FREE TICKETS
        if(ticket_chargeable == 0)
        {
            try {

                //allocate ticket 
                for(let ticket of tickets_to_purchase)
                {
                    let allocate_response = await DB.updateRecords('tickets', {
                        status: 'allocated',
                        price: ticket_meta.price,
                        owner_id: owner_id,
                        date_allocated: now
                    },
                    {
                        id: ticket.id
                    })

                    if (allocate_response.affectedRows == 0) {
                        throw 'Allocation failed'
                    }
                }
                    
                
            } catch (error) {
                console.log(error)
                Error('PURCHASE_FAILED','Purchase Failed','The ticket failed to allocate. Please Contact Support.',res)                
                return
            }


            let ticket_payload = {
                ids: ticket_ids,
                paid: ticket_chargeable,                
                meta: ticket_meta
            }

            console.log(`Free Ticket Purchased: ${ticket_payload.ids} - Paid: $${ticket_payload.paid/100}`);
            Respond('PURCHASE_SUCCESSFUL',ticket_payload,res);
        }
        else
        {            
            //PAID TICKETS
            let customer_id = customer.stripe_customer_id;
            
            let charge_description = `${event.name} - ${ticket_meta.name} - id: ${ticket_ids}`
            try {
                var charge_response = await adstripe.charge(customer_id, ticket_chargeable, charge_description)
            } catch (error) {
                Error(error.status, error.statusText, error.message, res);
                return
            }            

            if (charge_response.success === true) {
                //record charge
                try {
                    let record_charge_response = await DB.insertRecord('charges', {
                        id: charge_response.data.id,
                        ticket_ids: JSON.stringify(ticket_ids),
                        customer: charge_response.data.customer,
                        amount: charge_response.data.amount,
                        description: charge_description,
                        date: charge_response.data.created,
                        status: charge_response.data.status,
                        receipt: charge_response.data.receipt_url,
                        stripe_response: JSON.stringify(charge_response.data)
                    });
                } catch (error) {
                    console.log(error)
                    Error('PURCHASE_FAILED', 'Purchase Failed', 'The purchase failed to be recorded. Please Contact Support.', res)
                    return
                }


                for(let ticket of tickets_to_purchase)
                {
                    try {
                        //allocate ticket 
                        let allocate_response = await DB.updateRecords('tickets', {
                            status: 'allocated',
                            price: ticket_meta.price,
                            owner_id: owner_id,
                            date_allocated: now
                        },
                            {
                                id: ticket.id
                            })
    
                        if (allocate_response.affectedRows == 0) {
                            throw 'Allocation failed'
                        }
                    } catch (error) {
                        console.log(error);
                        Error('PURCHASE_FAILED', 'Purchase Failed', 'The ticket failed to allocate. Please Contact Support.', res);
                        return;
                    }
                }


                let ticket_payload = {
                    ids: ticket_ids,
                    paid: ticket_chargeable,
                    // tx_fee: ticket_to_purchase.tx_fee,
                    meta: ticket_meta
                }

                console.log(`Ticket Purchased: ${ticket_payload.ids} - Price: $${ticket_payload.paid / 100}`);
                Respond('PURCHASE_SUCCESSFUL', ticket_payload, res);
            }

        }
    }
    catch (error) {
        console.log(error);
        InternalServerError(res);
    }


})

app.post('/VerifyTicket', verifyToken, async (req, res) => {
    let merchant_user_id = req.user_id;
    let ticket_id = req.body.ticket_id;
    let signature = req.body.signature; //ticket signature
    let now = Math.round(new Date().getTime() / 1000);

    try {
        //verify signature
        let ticket_is_valid = await bcrypt.compare(`${TICKET_SECRET}${ticket_id}`, signature);

        if(ticket_is_valid !== true)
        {
            Error('INVALID_TICKET','Invalid Ticket','This is not a valid ticket',res);
            return
        }

        //verify ticket belongs to merchant event
        let merchant_user = await DB.getRecord('merchant_users', { id: merchant_user_id });
        if (merchant_user === undefined) { 
            Error('MERCHANT_USER_MISSING','Merchant User Missing','This merchant user could not be found',res);    
            return
        };

        let ticket = await DB.getRecord('tickets', { id: ticket_id });
        if (ticket === undefined) { 
            Error('TICKET_MISSING','Ticket Missing','There exists no ticket with this id',res);    
            return
         };

        //check if ticket -> meta -> merchant_id matches
        let ticket_meta = await DB.getRecord('tickets_meta', { id: ticket.meta_id });
        if (ticket_meta === undefined) {
            Error('TICKET_META_MISSING','Ticket Expired','This ticket is no longer in use.',res);    
            return
        };

        let event = await DB.getRecord('events',{id: ticket_meta.event_id});
        if (event === undefined) {
            Error('EVENT_MISSING','Event Missing','This event no longer exists.',res);    
            return
        };

        if(event.merchant_id != merchant_user.merchant_id)
        {
            console.log(merchant_user.merchant_id);
            console.log(event.merchant_id)
            Error('MERCHANT_MISMATCH','Merchant Mismatch','This ticket does not belong to an event hosted by the merchant trying to validate this ticket.',res);
            return
        }

        if (ticket.status == 'allocated') {
            let update_ticket = await DB.updateRecords('tickets', { status: 'consumed', date_verified: now }, { id: ticket_id });
            Respond('VERIFIED', {}, res)
            return
        }
        else if (ticket.status == 'consumed') {
            Respond('RE_ENTRY', {}, res)
            return
        }
        else
        {
            Error('TICKET_UNALLOCATED','Ticket Misallocation','There seems to be an error with the specified ticket. Please Contact Support for Help.',res);
            return
        }        
    }
    catch (error) {
        console.log(error);
        InternalServerError(res);
    }
})

//#endregion

//#region discount management
app.post('/CreateDiscount', async (req,res)=>{
    let discount_name = req.body.discount_name
    let description = req.body.description
    let amount = req.body.amount
    let count = req.body.count
    let merchant_id = req.body.merchant_id
    let exclusive = req.body.exclusive
    let priority = req.body.priority
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try {
        try {
            CheckRequiredFields({
                discount_name: discount_name,
                description: description,
                count: count,
                merchant_id: merchant_id,
                exclusive: exclusive,
                priority: priority,
                amount: amount
            })
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        let discount_meta = await DB.insertRecord('discounts_meta',{
            name: discount_name,
            description: description,
            merchant_id: merchant_id,
            exclusive: exclusive,
            priority: priority,
            amount: amount
        })
        

        let meta_id = discount_meta.insertId;
        for (let i = 0; i < count; i++) {
            await DB.insertRecord('discounts',
                {
                    meta_id: meta_id,
                    status: 'available',
                    date_created: dateCreated
                })
        }

        Respond('DISCOUNT_CREATED',{ticket_meta_id: meta_id,count: count},res);
    } catch (error) {
        console.log(error)
        InternalServerError(res);
    }

})

app.post('/DeleteDiscount', async (req,res)=>{
    let meta_id = req.body.meta_id;

    try {
        let removeMeta = await DB.deleteRecords('discounts_meta',{id: meta_id});
        let removeDiscounts = await DB.deleteRecords('discounts',{meta_id: meta_id});
        Respond('DELETED_DISCOUNTS',removeMeta,res);
    } catch (error) {
        console.log(error)
        InternalServerError(res);
    }
})

app.post('/MigrateDiscounts', async(req,res) => {
        
    let dateCreated = Math.round(new Date().getTime() / 1000);
    let secret = req.body.secret;

    if(secret !== JWT_SECRET)
    {
        Error('WRONG_SECRET','Wrong Secret','The provided secret is invalid',res);
        return
    }

    try {
        let discounts_meta = await DB.getRecords('discounts_meta');
        for(let discount of discounts_meta)
        {
            let numberOfDiscountsToPopulate = discount.curAvailCount;

            for(let i=0;i<numberOfDiscountsToPopulate;i++)
            {
                await DB.insertRecord('discounts',{
                    meta_id : discount.id,
                    status: 'available',
                    date_created: dateCreated
                })
            }
        }

        Respond('SUCCESS',{},res)
    } catch (error) {
        console.log(error);
        InternalServerError(res)
    }
})
//#endregion

//#region discount allocation

app.post('/AddToWallet',verifyToken, async (req,res)=>{
    let user_id = req.user_id;
    let discount_id = req.body.discount_id;
    let date = Math.round(new Date().getTime() / 1000);

    try 
    {
        try {
            CheckRequiredFields({user_id, discount_id})
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        let user = await DB.getRecord('users',{id: user_id});

        if(!user)
        {
            Error('NO_USER','No User','The specified user does not exist',res);
            return
        }

        //check if user owns this discount
        let currentlyOwned = await DB.getRecords('discounts',{meta_id: discount_id, owner_id: user_id, status: 'allocated'})

        if(currentlyOwned && currentlyOwned.length && currentlyOwned.length > 0)
        {
            Error('ALREADY_OWNED','Already Owned','You have already added this discount to your wallet',res);
            return
        }

        //check number discounts user has
        let userDiscountsCount = await DB.query('SELECT COUNT(*) FROM discounts WHERE owner_id=? AND status=\'allocated\'', [user_id]);

        if(userDiscountsCount && userDiscountsCount[0] && userDiscountsCount[0]['COUNT(*)'] >= 4)
        {
            Error('WALLET_FULL','Wallet Full','You can only have a maxium of 4 discounts at once. Use some discounts before adding new ones',res);
            return
        }

        let discountsAvailable = await DB.getRecords('discounts',{status: 'available', meta_id: discount_id});

        if(!Array.isArray(discountsAvailable) || discountsAvailable.length == 0)
        {
            Error('DISCOUNT_UNAVAILABLE','Discount Unavailable','The requested discount is no longer available',res);
            return
        }

        let discountToAllocate = discountsAvailable[0];

        let updateResponse = await DB.updateRecords('discounts',{owner_id: user_id, status: 'allocated', date_allocated: date},{id: discountToAllocate.id});
        console.log(`ADDED DISCOUNT owner_id: ${user_id} discount_id: ${discount_id}`);


        let discounts = await DB.getRecords('discounts',{owner_id: user_id, status: 'allocated'})
        let user_discounts = []
        for(let discount of discounts)
        {
            let discount_meta = await DB.getRecord('discounts_meta',{id: discount.meta_id})
            if(!discount_meta) continue;
            discount.meta = discount_meta;
            user_discounts.push(discount)
        }

        Respond('DISCOUNT_ADDED',user_discounts,res);
    }
    catch(error)
    {
        console.log(error)
        InternalServerError(res);
    }
})


app.post('/ClaimDiscount', verifyToken, async (req,res)=>{
    let user_id = req.user_id;
    let discount_id = req.body.discount_id;
    let merchant_code = req.body.merchant_code;
    let date = Math.round(new Date().getTime() / 1000);

    try {
        try {
            CheckRequiredFields({ user_id: user_id, discount_id: discount_id, merchant_code: merchant_code })
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }


        let discount = await DB.getRecord('discounts',{id: discount_id})
        
        if(!discount)
        {
            Error('DISCOUNT_MISSING','Discount Missing','The requested discount does not exist.', res);
            return
        }

        let discount_meta = await DB.getRecord('discounts_meta',{id: discount.meta_id});

        if(!discount_meta)
        {
            Error('DISCOUNT_MISSING','Discount Missing','The requested discount does not exist.', res);
            return
        }

        if(discount.owner_id != user_id)
        {
            Error('DISCOUNT_OWNER_MISMATCH','Discount Owner Mismatch','The discount does not belong to this user.', res);
            return
        }

        let merchant = await DB.getRecord('merchants',{id: discount_meta.merchant_id})

        if(!merchant)
        {
            Error('MERCHANT_MISSING','Merchant Missing','The merchant no longer exists', res);
            return
        }

        if(merchant.passcode != merchant_code)
        {
            Error('INVALID_MERCHANT_CODE','Wrong Code','The specified code is wrong. Please try again.', res)
            return
        }

        let updateResponse = await DB.updateRecords('discounts',{status: 'claimed', date_claimed: date},{id: discount_id});        

        let discounts = await DB.getRecords('discounts',{owner_id: user_id, status: 'allocated'})
        let user_discounts = []
        for(let discount of discounts)
        {
            let discount_meta = await DB.getRecord('discounts_meta',{id: discount.meta_id})
            if(!discount_meta) continue;
            discount.meta = discount_meta;
            user_discounts.push(discount)
        }

        Respond('DISCOUNT_CLAIMED',user_discounts,res);

    } catch (error) {
        console.log(error);
        InternalServerError(res);
    }
})
//#endregion

//#region stripe related 
app.post('/AddPaymentMethod', verifyToken, async (req, res) => {
    let user_id = req.user_id;
    let card_token = req.body.token;

    //find out if user is already a stripe customer
    try {
        try {
            CheckRequiredFields({ card_token: card_token, user_id: user_id });            
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return 
        }

        let adstripecustomer = await DB.getRecord('stripe_customers', { afterdark_id: user_id })
        if (adstripecustomer === undefined) {
            console.log('Creating new customer...')
            //create customer
            let user = await DB.getRecord('users', { id: user_id })

            if (!user || !user.email) {
                console.log(`no user with id ${user_id}`)
                Error('USER_MISSING','User Missing','The requested user does not exist',res);
                return
            }

            try {
                var customer = await adstripe.createCustomer(user.email, card_token);
            } catch (error) {
                Error(error.status,error.statusText,error.message,res);
                return;
            }

            let newCustomerResponse = await DB.insertRecord('stripe_customers', { afterdark_id: user_id, stripe_customer_id: customer.id});

            try {
                var stripe_customer_data = await adstripe.retrieveCustomer(customer.id);
            } catch (error) {
                Error(error.status,error.statusText,error.message,res);
                return;
            }

            Respond('PAYMENT_ADDED',stripe_customer_data,res);
        }
        else {
            console.log('Adding source to customer...')
            //add source
            let cus_token = adstripecustomer.stripe_customer_id;

            if (!cus_token) {
                Error('CUSTOMER_MISSING','Customer Missing','The stripe customer cannot be found. Please Contact Support',res);
                return
            }

            try {
                let response = await adstripe.addSourceToCustomer(cus_token, card_token);
                var stripe_customer_data = await adstripe.retrieveCustomer(cus_token);    
            } catch (error) {
                Error(error.status,error.statusText,error.message,res);
                return;
            }
            
            Respond('PAYMENT_ADDED',stripe_customer_data,res);
        }
    }
    catch (error) {
        console.log(error);
        InternalServerError(res);
    }
})

//normalize
app.post('/RemovePaymentMethod', verifyToken, async (req, res) => {
    let user_id = req.user_id;
    let card_id = req.body.card_id;

    //find out if user is already a stripe customer
    try {
        try {
            CheckRequiredFields({ card_id: card_id, user_id: user_id });            
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        let customer = await DB.getRecord('stripe_customers', { afterdark_id: user_id })
        let user = await DB.getRecord('users', { id: user_id })

        let cus_id = customer.stripe_customer_id;

        if (!customer || !customer.stripe_customer_id || !user || !user.email) {
            console.log(`no user with id ${user_id}`)
            Error('USER_MISSING','User Missing','The requested User does not exist. Please login again.',res)
            return
        }
        
        try {
            
            let response = await adstripe.removeSourceFromCustomer(cus_id, card_id);
            let stripe_customer_data = await adstripe.retrieveCustomer(customer.stripe_customer_id);            
            Respond('PAYMENT_REMOVED',stripe_customer_data, res)
        } catch (error) {
            Error(error.status,error.statusText,error.message,res);
            return
        }
    }
    catch (error) {
        console.log(error);
        InternalServerError(res);
    }
})

//normalize
app.post('/MakeDefaultPaymentMethod', verifyToken, async (req, res) => {
    let user_id = req.user_id;
    let card_id = req.body.card_id;

    //find out if user is already a stripe customer
    try {
        try {
            CheckRequiredFields({ card_id: card_id, user_id: user_id });            
        } catch (error) {
            Error(strings.MISSING_FIELDS.STATUS,strings.MISSING_FIELDS.STATUSTEXT,error,res);
            return
        }

        let customer = await DB.getRecord('stripe_customers', { afterdark_id: user_id })
        let user = await DB.getRecord('users', { id: user_id })

        if (!customer || !user || !user.email) {
            console.log(`no user with id ${user_id}`)
            Error('USER_MISSING','User Missing','The requested User does not exist. Please login again.',res)
            return
        }

        let cus_id = customer.stripe_customer_id;

        try {
            let response = await adstripe.makeDefaultSource(cus_id, card_id);
            let stripe_customer_data = await adstripe.retrieveCustomer(customer.stripe_customer_id);            
            Respond('PAYMENT_CHANGED',stripe_customer_data,res);
        } catch (error) {
            Error(error.status,error.statusText,error.message,res);
            return       
        }        
    }
    catch (error) {
        console.log(error);
        InternalServerError(res);
    }
})

app.post('/RetrieveStripeCustomer', verifyToken, async (req, res) => {
    let user_id = req.user_id;

    try {
        CheckRequiredFields({ user_id: user_id });
        let user = await DB.getRecord('stripe_customers', { afterdark_id: user_id })

        if (user === undefined) {
            Error('CUSTOMER_MISSING','User Missing','The requested user is not a stripe customer. Please login again.',res)
            return
        }

        try {
            let customer = await adstripe.retrieveCustomer(user.stripe_customer_id);
            Respond('RETRIEVED_CUSTOMER',customer,res);
        } catch (error) {
            Error(error.status,error.statusText,error.message,res);
            return
        }        
    }
    catch (error) {
        console.log(error)
        InternalServerError(res);
    }
})

//#endregion

async function verifyToken(req, res, next) {
    let token = req.headers.authorization;
    if (token === undefined) {
        Error('AUTHENTICATION_MISSING','No Token','Authentication token missing',res);
        return
    }

    try {
        let token_body = await jwt.verify(token, JWT_SECRET);

        // let user = await DB.getRecord('users',{user_id: token_body.id});
        // if(user === undefined)
        // {
        //     let merchant = await DB.getRecord('merchant_users',{user_id: token_body.id})

        //     if()
        //     {

        //     }
        // }
        req.user_id = token_body.id;
        req.email = token_body.email;
    }
    catch (error) {
        console.log(error)
        Error('AUTHENTICATION_FAILED','Token Invalid','The given token is invalid',res);
        return
    }

    next();
}

function Output(success, message, res) {
    var response = { success: success, output: message };
    res.status(200);
    res.json(response);
}

function Respond(status='SUCCESS',data={}, res, code = 200)
{
    var response = {
        status : status,
        data : data
    }    
    res.status(code);
    res.json(response);
}

function Error(status, statusText, message, res, code = 400)
{
    var response = {
        status : 'ERROR',
        error : {
            status : status,
            statusText : statusText,
            message: message
        }
    }

    res.status(code);
    res.json(response);
}

function InternalServerError(res,error)
{
    if(error)
    {
        console.log(error)
    }
    
    res.status(500);
    res.json({status: 'EXCEPTION', error: {
        status: 'SERVER_ERROR',
        statusText: 'Server Error',
        message: 'An internal server error has occured. Please try again later',
        extra: error ? error: null
    }})
}

function CheckRequiredFields(object) {
    for (var key in object) {
        if (object[key] === undefined || object[key] === null || object[key] === '') {
            throw `Required value missing: ${key}`
        }
    }
}

function ThrowWithMessageIfEmpty(object, message) {
    if (object === undefined || object === null) {
        throw message
    }
    else if (Array.isArray(object) && object.length === 0) {
        console.log('array')
        throw message
    }
}

function DateFormatPresentable(epoch)
{
    let date = new Date(0); // The 0 there is the key, which sets the date to the epoch
    date.setSeconds(epoch);
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString("en-US", options) + ` - ${date.getHours()}:${date.getMinutes()}`; // Saturday, September 17, 2016
}

module.exports = app;

