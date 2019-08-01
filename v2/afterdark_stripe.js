const config = require('../config');
const token = config.live ? 'sk_live_cHSmPEmRtoLDHtMmva84qH48' : 'sk_test_ZnonTx9hyHKYUZPc3i0xogKU';

var stripe = require('stripe')(token);



module.exports.createCustomer = async (email, source_token) => {
    try {
        let customer = await stripe.customers.create({
            email: email,
            source: source_token
        })

        return customer;
    }
    catch (error) {
        HandleStripeError(error)
    }
}

module.exports.retrieveCustomer = async (customer_id) => {
    try {
        let response = await stripe.customers.retrieve(`${customer_id}`)
        return response
    }
    catch (error) {
        HandleStripeError(error)
    }
}

module.exports.addSourceToCustomer = async (customer_id, card_token) => {
    try {
        let response = await stripe.customers.createSource(
            customer_id,
            {
                source: card_token
            }
        );

        return response;
    }
    catch (error) {
        HandleStripeError(error)
    }
}

module.exports.removeSourceFromCustomer = async (customer_id, card_id) => {
    try {
        let response = await stripe.customers.deleteCard(
            customer_id,
            card_id
        );

        return response;
    }
    catch (error) {
        HandleStripeError(error)
    }
}

module.exports.makeDefaultSource = async (customer_id, card_id) => {
    try {
        let response = await stripe.customers.update(customer_id, {
            default_source: card_id
        });

        return response;
    }
    catch (error) {
        HandleStripeError(error)
    }
}

module.exports.charge = async (customer_id, amount, description) => {
    try {
        let response = await stripe.charges.create({
            amount: amount,
            currency: "sgd",
            description: description,
            customer: customer_id,
        })

        // console.log(response);
        return { success: true, data: response }
    }
    catch (error) {
        HandleStripeError(error)
    }
}

function HandleStripeError(error) {
    console.log(error)
    switch (error.type) {
        case 'StripeCardError':
            // A declined card error
            throw {
                status: 'STRIPE_ERROR',
                statusText: 'Card Error',
                message: error.message
            }
            break;
        case 'RateLimitError':
            // Too many requests made to the API too quickly
            throw {
                status: 'STRIPE_ERROR',
                statusText: 'Request Error',
                message: error.message + '. Please try again later.'
            }
            break;
        case 'StripeInvalidRequestError':
            // Invalid parameters were supplied to Stripe's API
            throw {
                status: 'STRIPE_ERROR',
                statusText: 'Request Error',
                message: error.message
            }
            break;
        case 'StripeAPIError':
            // An error occurred internally with Stripe's API
            throw {
                status: 'STRIPE_ERROR',
                statusText: 'Stripe Error',
                message: error.message + '. Please try again later.'
            }
            break;
        case 'StripeConnectionError':
            // Some kind of error occurred during the HTTPS communication
            throw {
                status: 'STRIPE_ERROR',
                statusText: 'Connection Error',
                message: error.message + '. Please try again later.'
            }
            break;
        case 'StripeAuthenticationError':
        default:
            throw {
                status: 'STRIPE_ERROR',
                statusText: 'Error',
                message: 'An Unexpected Error has occured. Please try again later.'
            }
            break;
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


