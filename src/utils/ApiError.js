class ApiError extends Error {
    constructor(
        statusCode,
        message= 'Something went wrong',
        errors = [],
        stack = "",
    ){
        super(message)         // we use super to overwrite and then we can overwrite further if we want
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        if (stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}