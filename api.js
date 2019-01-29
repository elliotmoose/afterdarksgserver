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
const TICKET_SECRET = 'gskradretfa'
const EXPIRY_PERIOD = 3600 * 24 * 2; //24 hours
const SALT_ROUNDS = 10;

// Handles request to root only.
app.get('/', (req, res) => {
    res.status(200);
    res.type('text/html');
    res.sendFile(path.resolve(__dirname, 'index.html'));
});


//#region get generic data 
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

        Output(true, discounts, res);
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

//#region get user data
app.post('/GetWalletForUser', verifyToken, async (req, res) => {
    let user_id = req.user_id;
    try {
        let tickets = await DB.getRecords('tickets', { owner_id: user_id });
        // let discounts = await DB.getRecords('discounts',{owner_id: user_id});

        let output = {
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
                        output.tickets.push(ticket);
                    }
                }
            }


        }


        Output(true, output, res)
    }
    catch (error) {
        console.log(error)
        Output(false, error, res);
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
                throw "Invalid Password"
            }

            console.log(`MERCHANT LOGGED IN: ${username}`);

            merchantData.password = undefined;
            merchantData.type = 'MERCHANT'
            let token = await jwt.sign({id: merchantData.id, email: merchantData.email}, JWT_SECRET);
            merchantData.token = token;
            Output(true,merchantData,res);
            return
        }


        var userData = await DB.getRecord('users', { username: username });
        if (userData === undefined) //username doesnt exist
        {
            throw "Invalid Username"
        }

        var correctPass = await bcrypt.compare(password, userData.password)

        if (!correctPass) {
            throw "Invalid Password"
        }

        console.log(`USER LOGGED IN: ${username}`);

        userData.password = undefined
        userData.type = 'USER'
        let token = await jwt.sign({ id: userData.id, email: userData.email }, JWT_SECRET);
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
        var userResult = await DB.getRecord('facebook_users', { id: id });

        if (userResult !== undefined) //User exists, logging in
        {
            let existingADUser = await DB.getRecord('users', { email: email })
            let existingADMerchant = await DB.getRecord('merchant_users', { email: email })
            if (userResult.email != email) //user has id, but email mismatches with fb db. meaning user changed email
            {
                //we then want to help user update. but we need to also check if the email has been used to create another afterdark user account

                if (existingADUser !== undefined || existingADMerchant !== undefined) //there exists a user with that email already
                {
                    Output(false, 'It seems your Facebook email has changed. The new email has already been used to create an Afterdark account.', res)
                    return
                }
                else {
                    await DB.updateRecords('facebook_users', { email: email }, { id: id })
                    console.log(`Updating email from ${userResult.email} to ${email}`)
                }
            }

            console.log('Facebook User Logged In')
            let token = await jwt.sign({ id: existingADUser.id, email: existingADUser.email }, JWT_SECRET);
            existingADUser.token = token;
            Output(true, existingADUser, res);
        }
        else //User does not exist, generate an account
        {
            let userWithSameEmail = await DB.getRecord('users', { email: email })

            if (userWithSameEmail !== undefined) {
                Output(false, "Your Facebook email has already been used to create an account", res)
                return
            }

            await DB.insertRecord('users', { email: email, gender: gender, age: age, date_begin: dateBegin })
            let newUserData = await DB.getRecord('users', { email: email });
            await DB.insertRecord('facebook_users', { id: id, afterdark_id: newUserData.id, email: email, name: name, age: age, gender: gender, date_begin: dateBegin })
            console.log('Facebook User Created')

            let token = await jwt.sign({ id: newUserData.id, email: newUserData.email }, JWT_SECRET);
            newUserData.token = token;
            Output(true, newUserData, res);
        }
    }
    catch (err) {
        console.log(err)
        Output(false, err, res);
    }
})

app.post('/RetrieveCustomer', async (req, res) => {
    let ad_userid = req.body.id;
    let token = req.body.token;
    let email = req.body.email;

    try {
        CheckRequiredFields({ ad_userid, token, email });

        //step 1: check if user has a customer
        let ad_customer = await DB.getRecord('stripe_customers', { afterdark_id: ad_userid })

        //step 2a: if has, return customer id
        if (ad_customer !== undefined) {
            let customer_id = ad_customer.stripe_customer_id;
            Output(true, customer_id, res);
        }
        else //step 2b: if not, create customer
        {
            let customer = await adstripe.createCustomer(email, token);
            await DB.insertRecord('stripe_customers', { afterdark_id: ad_userid, stripe_customer_id: customer.id })
        }
    }
    catch (error) {
        Output(false, error, res)
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
        CheckRequiredFields({ username, password, email });
        let usernameRecords = await DB.getRecord('users', { username: username })
        let merchantUsernameRecord = await DB.getRecord('merchant_users', { username: username }) //check against merchants in case        

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
                Output(true, userData, res)
            }
            else {
                throw 'Email already exists';
            }
        }
        else {
            throw 'Username already taken';
        }
    }
    catch (e) {
        console.log(e)
        Output(false, e, res)
    }
})

//#endregion

//#region event/ticket management
app.post('/CreateTicket', async (req, res) => {
    let name = req.body.name;
    let description = req.body.description;
    let count = req.body.count;
    let price = req.body.price;
    let event_id = req.body.event_id;
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try {
        CheckRequiredFields({
            name: name,
            description: description,
            count: count,
            price: price,
            event_id: event_id,
        })

        let checkEvent = await DB.getRecord('events', { id: event_id })

        if (checkEvent === undefined) {
            throw 'The event you are trying to create a ticket for does not exist';
        }

        let ticket_meta = await DB.insertRecord('tickets_meta', {
            name: name,
            description: description,
            event_id: event_id,
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

        Output(true, ticket_meta, res)
    }
    catch (error) {
        console.log(error)
        Output(false, error, res)
    }
})

app.post('/DeleteEvent', async (req, res) => {
    let event_id = req.body.event_id;

    try {
        let getEvent = await DB.getRecord('events', { id: event_id });

        if (getEvent === undefined) {
            throw "The event does not exist";
        }

        let metas = await DB.getRecords('tickets_meta', { event_id: event_id });

        if (metas.length !== 0) {
            for (let meta of metas) {
                await DB.deleteRecords('tickets', { meta_id: meta.id });
            }
        }

        await DB.deleteRecords('tickets_meta', { event_id: event_id });
        await DB.deleteRecords('events', { id: event_id });

        Output(true, 'Deleted', res);
    }
    catch (err) {
        console.log(err)
        Output(false, err, res)
    }
})

app.post('/DeleteTicket', async (req, res) => {

    let ticket_meta_id = req.body.meta_id;
    try {
        await DB.deleteRecords('tickets_meta', { id: ticket_meta_id })
        await DB.deleteRecords('tickets', { meta_id: ticket_meta_id })
        Output(true, 'Deleted', res)
    }
    catch (err) {
        console.log(err)
        Output(false, err, res)
    }
})

app.post('/CreateEvent', async (req, res) => {
    let name = req.body.name;
    let merchant_id = req.body.merchant_id;
    let location = req.body.location;
    let date = req.body.date;
    let time = req.body.time;
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try {
        let merchant = await DB.getRecord('merchants', { id: merchant_id })

        if (merchant === undefined) {
            throw "Merchant does not exist"
        }

        let output = await DB.insertRecord('events', { name: name, merchant_id: merchant_id, location: location, time: time, date: date, created: dateCreated })
        Output(true, output, res)
    }
    catch (error) {
        console.log(error)
        Output(false, error, res)
    }
})

//#endregion

//#region ticket purchase/verify
app.post('/PurchaseTicket', verifyToken, async (req, res) => {
    let owner_id = req.user_id;
    let ticket_meta_id = req.body.ticket_meta_id;
    let transaction_token = req.body.transaction_token;

    try {
        CheckRequiredFields({ owner_id, ticket_meta_id });
        //check owner exists
        let user = await DB.getRecord('users', { id: owner_id });
        ThrowWithMessageIfEmpty(user, 'User does not exist')
        let ticket_meta = await DB.getRecord('tickets_meta', { id: ticket_meta_id })
        ThrowWithMessageIfEmpty(ticket_meta, 'Ticket does not exist')
        let event = await DB.getRecord('events', { id: ticket_meta.event_id })
        ThrowWithMessageIfEmpty(event, 'Event does not exist')
        //check ticket availability
        let tickets = await DB.getRecords('tickets', { meta_id: ticket_meta_id, status: 'available' })
        ThrowWithMessageIfEmpty(tickets, 'There are no more such tickets available')

        //purchase
        // - get stripe customer from adUser_id
        // - create charge for this customer
        // - on success, allocate ticket
        let customer = await DB.getRecord('stripe_customers', { afterdark_id: owner_id });
        ThrowWithMessageIfEmpty(customer, 'User is not a stripe customer')


        let customer_id = customer.stripe_customer_id;
        let ticket_to_purchase = tickets[0];
        let ticket_chargeable = ticket_to_purchase.price + ticket_to_purchase.tx_fee;

        // console.log(`Charging ${ticket_chargeable} to ${customer_id} for ticket: ${ticket_to_purchase.id}`);
        let charge_description = `${event.name} - ${ticket_meta.name} - id: ${ticket_to_purchase.id}`
        let charge_response = await adstripe.charge(customer_id, ticket_chargeable, charge_description)

        if (charge_response.success === true) {
            //record charge
            let record_charge_response = await DB.insertRecord('charges', {
                id: charge_response.output.id,
                customer: charge_response.output.customer,
                amount: charge_response.output.amount,
                description: charge_description,
                date: charge_response.output.created,
                status: charge_response.output.status,
                receipt: charge_response.output.receipt_url,
                stripe_response: JSON.stringify(charge_response.output)
            });

            //allocate ticket 
            let allocate_response = await DB.updateRecords('tickets', {
                status: 'allocated',
                owner_id: owner_id
            },
                {
                    id: ticket_to_purchase.id
                })

            if (allocate_response.affectedRows == 0) {
                throw 'Allocation failed at updating ticket owner';
            }

            let ticket_payload = {
                id: ticket_to_purchase.id,
                price: ticket_to_purchase.price,
                tx_fee: ticket_to_purchase.tx_fee,
                meta: ticket_meta
            }

            console.log(ticket_payload);
            Output(true, ticket_payload, res);
        }
        else {

        }

    }
    catch (error) {
        console.log(error)
        Output(false, error, res)
    }


})

app.post('/VerifyTicket', verifyToken, async (req, res) => {
    let merchant_user_id = req.user_id;
    let ticket_id = req.body.ticket_id;
    let signature = req.body.signature; //ticket signature
    ticket_id = 2;
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
            let update_ticket = await DB.updateRecords('tickets', { status: 'consumed' }, { id: ticket_id });
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
    let rating = req.body.rating
    let dateCreated = Math.round(new Date().getTime() / 1000);

    try {
        try {
            CheckRequiredFields({
                discount_name: discount_name,
                description: description,
                count: count,
                merchant_id: merchant_id,
                exclusive: exclusive,
                rating: rating,
                amount: amount
            })
        } catch (error) {
            Error('MISSING_FIELD','Missing Field',error,res);
            return
        }

        let discount_meta = await DB.insertRecord('discounts_meta',{
            name: discount_name,
            description: description,
            merchant_id: merchant_id,
            exclusive: exclusive,
            rating: rating,
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

//#endregion

//#region discount allocation

app.post('/AddToWallet',verifyToken, async (req,res)=>{
    let user_id = req.user_id;
    let discount_id = req.body.discount_id;

    try 
    {
        if(!user_id)
        {
            Error('MISSING_FIELD','User id missing','A user id was not specified',res);
            return
        }

        if(!discount_id)
        {
            Error('MISSING_FIELD','Discount id missing','A discount id was not specified',res);
            return
        }

        let user = await DB.getRecord('users',{id: user_id});

        if(!user)
        {
            Error('NO_USER','No User','The specified user does not exist',res);
            return
        }

        let discountToAllocate = await DB.getRecord('discounts',{status: 'available'});

        if(!discountToAllocate)
        {
            Error('DISCOUNT_UNAVAILABLE','Discount Unavailable','The requested discount is no longer available',res);
            return
        }

        let updateResponse = await DB.updateRecords('discounts',{owner_id: user_id, status: 'allocated'});

        Respond('DISCOUNT_ADDED',{},res);
    }
    catch(error)
    {
        console.log(error)
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
        CheckRequiredFields({ card_token: card_token, user_id: user_id });

        let customer = await DB.getRecord('stripe_customers', { afterdark_id: user_id })
        if (customer === undefined) {
            console.log('Creating new customer...')
            //create customer
            let user = await DB.getRecord('users', { id: user_id })


            if (user === undefined || user.email === undefined || user.email === null) {
                console.log(`no user with id ${user_id}`)
                throw 'User does not exist'
            }

            let customer = await adstripe.createCustomer(user.email, card_token);
            let newCustomerResponse = await DB.insertRecord('stripe_customers', { afterdark_id: user_id, stripe_customer_id: customer.id })
            let stripe_customer_data = await adstripe.retrieveCustomer(customer.id);
            Output(true, stripe_customer_data, res);
        }
        else {
            console.log('Adding source to customer...')
            //add source
            let cus_token = customer.stripe_customer_id;

            if (cus_token === undefined || cus_token === null) {
                throw 'Database inconsistency: the stripe customer cannot be found. Please contact support'
            }

            let response = await adstripe.addSourceToCustomer(cus_token, card_token);
            let stripe_customer_data = await adstripe.retrieveCustomer(cus_token);
            Output(true, stripe_customer_data, res);
        }
    }
    catch (error) {
        console.log(error);
        Output(false, error, res);
    }
})

app.post('/RemovePaymentMethod', verifyToken, async (req, res) => {
    let user_id = req.user_id;
    let card_id = req.body.card_id;

    //find out if user is already a stripe customer
    try {
        CheckRequiredFields({ card_id: card_id, user_id: user_id });

        let customer = await DB.getRecord('stripe_customers', { afterdark_id: user_id })
        let user = await DB.getRecord('users', { id: user_id })

        if (customer === undefined || user === undefined || user.email === undefined || user.email === null) {
            console.log(`no user with id ${user_id}`)
            throw 'User does not exist'
        }

        let cus_id = customer.stripe_customer_id;

        let response = await adstripe.removeSourceFromCustomer(cus_id, card_id);
        let stripe_customer_data = await adstripe.retrieveCustomer(customer.stripe_customer_id);
        Output(true, stripe_customer_data, res);
    }
    catch (error) {
        console.log(error);
        Output(false, error, res);
    }
})

app.post('/MakeDefaultPaymentMethod', verifyToken, async (req, res) => {
    let user_id = req.user_id;
    let card_id = req.body.card_id;

    //find out if user is already a stripe customer
    try {
        CheckRequiredFields({ card_id: card_id, user_id: user_id });

        let customer = await DB.getRecord('stripe_customers', { afterdark_id: user_id })
        let user = await DB.getRecord('users', { id: user_id })

        if (customer === undefined || user === undefined || user.email === undefined || user.email === null) {
            console.log(`no user with id ${user_id}`)
            throw 'User does not exist'
        }

        let cus_id = customer.stripe_customer_id;

        let response = await adstripe.makeDefaultSource(cus_id, card_id);
        let stripe_customer_data = await adstripe.retrieveCustomer(customer.stripe_customer_id);
        Output(true, stripe_customer_data, res);
    }
    catch (error) {
        console.log(error);
        Output(false, error, res);
    }
})

app.post('/RetrieveStripeCustomer', verifyToken, async (req, res) => {
    let user_id = req.user_id;

    try {
        CheckRequiredFields({ user_id: user_id });
        let user = await DB.getRecord('stripe_customers', { afterdark_id: user_id })

        if (user === undefined) {
            throw 'User is not a stripe customer'
        }

        let customer = await adstripe.retrieveCustomer(user.stripe_customer_id);
        Output(true, customer, res);
    }
    catch (error) {
        console.log(error)
        Output(false, error, res);
    }
})

//#endregion

async function verifyToken(req, res, next) {
    let token = req.headers.authorization;
    if (token === undefined) {
        Output(false, 'Missing authorization token', res)
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
        Output(false, 'Authorization Token Invalid', res);
        return
    }

    next();
}

function CheckDiscountHasExpired(discount) {
    var epoch = Math.round(new Date().getTime() / 1000);
    return (epoch - discount.expiry) < 3600 * 24 * 2;
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

function InternalServerError(res)
{
    res.status(500);
    res.json({status: 'EXCEPTION', error: {
        status: 'SERVER_ERROR',
        statusText: 'Server Error',
        message: 'An internal server error has occured. Please try again later'
    }})
}

function CheckRequiredFields(object) {
    for (var key in object) {
        if (object[key] === undefined || object[key] === null) {
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

module.exports = app;

