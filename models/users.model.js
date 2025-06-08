const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name: {type: String},
    picture: {type: String},
    bio: {type: String},
    following: {
        type: Boolean,
        default: false
    },
    post: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Posts"
    }], 
    email: { type: String, required: true, unique: true },
    password: {type: String, required: true},
})

const Users = mongoose.model("Users", userSchema)

module.exports = { Users }