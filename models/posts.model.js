const mongoose = require('mongoose')

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
    },
    likes: {
      type: Number,
      default: 0, 
    },
      like: {
        type: Boolean,
        default: false, 
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    },
    media: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Image",
      default: null 
    },
})

const Posts = mongoose.model("Posts", postSchema)

module.exports = { Posts }