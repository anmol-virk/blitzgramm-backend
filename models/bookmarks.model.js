const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", },
  },
 
);

const Bookmark = mongoose.model("Bookmark", bookmarkSchema);

module.exports = { Bookmark }
