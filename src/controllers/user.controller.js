import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const refreshToken = user.generateRefreshToken()
        const accessToken = user.generateAccessToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        // console.log(accessToken,"<<<**000**>>>",refreshToken)

        return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong whlie generating access and refresh token")
        
    }
} 

const registerUser = asyncHandler( async (req,res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists : userName , email 
    // check for images , check for avatar 
    // upload them to cloudinary
    // create user object - create entry in db
    // remove passwprd and refresh token field from response
    // check for user creation
    // return res

    const {fullName ,email , userName , password} = req.body
    console.log(fullName ,email )



    if(
        [fullName ,email , userName , password].some((field)=>
           field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }



    const existedUser = await User.findOne({
        $or: [{email}, {userName}]
    })
    if (existedUser){
        throw new ApiError(400,"User already exists")
    }



    const  avatarLocalPath =  req.files?.avatar[0]?.path
    // const  coverImageLocalPath =  req.files?.coverImage[0]?.path
    console.log(req.files)
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }
    let  coverImageLocalPath;
    let  coverImageUrl = "";
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath =  req.files?.coverImage[0]?.path
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
        coverImageUrl = coverImage.url
    }





    const avatar = await uploadOnCloudinary(avatarLocalPath)
    // const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar){
        throw new ApiError(400,"Avatar upload failed")
    }



    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImageUrl,
        // coverImage : coverImage?.url||"",
        email,
        password,
        userName : userName.toLowerCase()
    })



    const createdUser = User.findById(user._id).select(
        "-password -refreshToken"
    )



    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }




    return res.status(201).json(
        new ApiResponse(200,createdUser,"user created successfully")
    )


})

const loginUser = asyncHandler( async(req,res)=>{
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send the response/cookie

    const {email,userName,password} = req.body
    
    
    
    if (!userName && !email){
        throw new ApiError(400,"Please provide email or username")
    }
    
    
    
    const user = await User.findOne({
        $or : [{email},{userName}]
    })
    if (!user){
        throw new ApiError(400,"Invalid email or username")
    }
    
    
    

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid){
        throw new ApiError(400,"Invalid password")
    }



    const { accessToken,refreshToken } = await generateAccessAndRefreshTokens(user._id)
    // console.log(accessToken,"<<<>>>",refreshToken)


    const loggedInUser = await User.findById(user._id).select('-password -refreshToken')



    const options = {
        httpOnly: true,
        secure : true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler( async(req,res)=>{
    // clear refresh and access token

    await User.findByIdAndUpdate(
        req.user._id,
        {
            // $set:{
            //     refreshToken : undefined
            // }
            $unset:{
                refreshToken : 1  // this removes field from document
            }
        },
        {
            new:true     // return mai jo response milega usme new updated value milagi
        }
    )

    const options = {
        httpOnly: true,
        secure : true,
    }

    return res 
    .status(200)
    .clearCookie('accessToken',options)
    .clearCookie('refreshToken',options)
    .json(new ApiResponse(200,{},"User logged out"))

}) 

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken ||req.body.refreshToken
    if (!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    console.log(incomingRefreshToken,"->->->->")
// try {
    
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        console.log(decodedToken,"----")
    
        const user =   await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure:true,
        }
        const {accessToken ,refreshToken} = await generateAccessAndRefreshTokens(user._id)
        console.log(accessToken,"<<<>>>",refreshToken)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken},
                "access token refreshed")
        )
    
// } catch (error) {
//     throw new ApiError(401,"not valid refresh token")
    
// }
})

const changeCurrentPassword = asyncHandler( async (req,res)=>{
    const {oldPassword,newPassword} = req.body

    const user = await  User.findById(req.user?._id)
    const isPasswordCorrect =   user.isPasswordCorrect(oldPassword,)

    if (!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"password change successfully"))
})

const getCurrentUser = asyncHandler(async (req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user fetched"))
})

const updateAccountDetails = asyncHandler( async (req,res)=>{
    const {fullName,email} = req.body

    if (!fullName || !email){
        throw new ApiError(400,"all field are required")
    }
    
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {   
            $set: {
                fullName :fullName,      // or
                fullName,
                email
            }
        },
        {new:true}
    ).select("-password")

    console.log(user.fullName , user.email)
    
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details  updated"))
})

const updateUserAvatar = asyncHandler( async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse( 200,user,"Avatar updated successfully")
    )

})

const updateUserCoverImage = asyncHandler( async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading cover image to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse( 200,user,"coverImage updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params    // url se
    if (!username?.trim()){
        throw new ApiError(400,"username is missing")
    }
    console.log(username)

    const channel = await User.aggregate([
        {
            $match:{                                      // user ko match or find kiya
                userName: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{                                       // original data (User) main aur fields add krde
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                userName:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1,
            }
        }
    ])

    if (!channel?.length){
        throw new ApiError(404,"Channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler(async (req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:'video',
                localField:'watchHistory',
                foreignField:'_id',
                as:'watchHistory',
                pipeline:[
                    {
                        $lookup:{
                            from:'user',
                            localField:'owner',
                            foreignField:'_id',
                            as:'owner',
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        userName:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        },
                    },
                    {
                        $addFields:{
                            owner:{
                                $first  :"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"watch history fetched successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,

    
}