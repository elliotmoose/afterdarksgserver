const token = false ? 'sk_live_vvEQ4kyBLXF9wpESXRQ9C0dH' : 'sk_test_7Qayj2QSF28xVOlDnP5AcqAd';

var stripe = require('stripe')(token);



module.exports.createCustomer = async (email, source_token) => {
    let customer = await stripe.customers.create({
        email : email,
        source : source_token
    })

    return customer;
}

module.exports.retrieveCustomer = async (customer_id) => {
    return stripe.customers.retrieve(`${customer_id}`)
}

module.exports.addSourceToCustomer = async (customer_id, card_token) => {
    let response = await stripe.customers.createSource(
        customer_id,
        { 
            source: card_token
        }
    );

    return response;
}


module.exports.removeSourceFromCustomer = async (customer_id, card_id) => {
    let response = await stripe.customers.deleteCard(
        customer_id,
        card_id
    );

    return response;
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


