import mongoose from "mongoose"
import dotenv from "dotenv"
import db_connect from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: "./.env",
})

db_connect()
.then(()=>{
    app.on("error",(error)=>{
        console.log("express connecting error",error)
    })
    app.listen(process.env.PORT,()=>{
        console.log(`Server is running on port ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("db connection error !!!",error)
})






















































// first approach (all in one)

// import mongoose from "mongoose"
// import { DB_NAME } from "./constants";

// import express from "express"
// const app = express()

// ;( async ()=>{
//     try{
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error",(error)=>{
//             console.log("Error",error)
//             throw error
//         })
//         app.listen(process.env.PORT,()=>{
//             console.log("Server is running on port",process.env.PORT)
//         })
        
//     }
//     catch (error){
//         console.error("ERROR",error)
//         throw error
//     }
// })()