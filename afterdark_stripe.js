const token = false ? 'sk_live_cHSmPEmRtoLDHtMmva84qH48' : 'sk_test_ZnonTx9hyHKYUZPc3i0xogKU';

var stripe = require('stripe')(token);



module.exports.createCustomer = async (email, source_token) => {
    try 
    {
        let customer = await stripe.customers.create({
            email : email,
            source : source_token
        })
    
        return customer;
    }
    catch(error)
    {
        throw 'Could not connect to stripe'
    }    
}

module.exports.retrieveCustomer = async (customer_id) => {
    try 
    {
        let response = await stripe.customers.retrieve(`${customer_id}`)
        return response
    }
    catch(error)
    {
        throw 'Could not connect to stripe'
    }    
}

module.exports.addSourceToCustomer = async (customer_id, card_token) => {
    try 
    {        
        let response = await stripe.customers.createSource(
            customer_id,
            { 
                source: card_token
            }
        );
    
        return response;
    }
    catch(error)
    {
        console.log(error)
        throw 'Could not connect to stripe'
    }    
}

module.exports.removeSourceFromCustomer = async (customer_id, card_id) => {
    try 
    {
        let response = await stripe.customers.deleteCard(
            customer_id,
            card_id
        );
    
        return response;
    }
    catch(error)
    {
        throw 'Could not connect to stripe'
    }   
}

module.exports.makeDefaultSource = async (customer_id,card_id) => {    
    try 
    {
        let response = await stripe.customers.update(customer_id, {
            default_source: card_id
        });
    
        return response;
    }
    catch(error)
    {
        throw 'Could not connect to stripe'
    }   
}

module.exports.charge = async (customer_id,amount,description) => {
    try 
    {
        let response = await stripe.charges.create({
            amount: amount,
            currency: "sgd",
            description : description,
            customer: customer_id,    
        })
        
        // console.log(response);
        return {success: true, output: response}
    } 
    catch (error) {
        return {success: false, output: error}
    }
}

// return stripe.customers.create({
//     email: 'YOUR_EMAILtest@test.com',
//     source: req.body.tokenId
//   })
//   .then(customer => {
//     stripe.charges.create({
//       amount: req.body.amount, // Unit: cents
//       currency: 'eur',
//       customer: customer.id
//       source: customer.default_source.id,
//       description: 'Test payment',
//     })
//   })
//   .then(result => res.status(200).json(result))


