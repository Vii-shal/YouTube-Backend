import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const refreshToken = user.generateRefreshToken()
        const accessToken = user.generateAccessToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

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
            $set:{
                refreshToken : undefined
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

export {
    registerUser,
    loginUser,
    logoutUser,
}