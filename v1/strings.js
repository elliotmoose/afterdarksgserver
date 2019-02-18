const status = {
    REGISTRATION_CONFLICT : 'REGISTRATION_CONFLICT',
    MISSING_FIELDS : 'MISSING_FIELDS'
}


module.exports = {
    MISSING_FIELDS : {
        STATUS: status.MISSING_FIELDS,
        STATUSTEXT: 'Missing Fields'
    },
    EMAIL_TAKEN : {
        STATUS : status.REGISTRATION_CONFLICT,
        STATUSTEXT: 'Email Taken',
        MESSAGE: 'The email you have specificed has already been used.'
    },
    USERNAME_TAKEN : {
        STATUS : status.REGISTRATION_CONFLICT,
        STATUSTEXT: 'Username Taken',
        MESSAGE: 'The username you have specificed has already been used.'
    }
}