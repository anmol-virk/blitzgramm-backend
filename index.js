require("dotenv").config()
const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const { initializeDatabase } = require("./db/db.connect")
const { Posts } = require("./models/posts.model")
const { Users } = require("./models/users.model")
const { Bookmark } = require("./models/bookmarks.model")
const { default: mongoose } = require("mongoose")
const multer = require("multer")
const cloudinary = require("cloudinary")
const dotenv = require("dotenv")
const bodyParser = require("body-parser")
const { ImageModel } = require("./models/images.model")
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.use(bodyParser.json())

initializeDatabase()

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
    const token = authHeader.split(' ')[1];

    if(!token) {
        return res.status(401).json({ message: "No token provided."})
    }
    try{
         const decodedToken = jwt.verify(token, process.env.JWT_SECRET)
         req.user = decodedToken
         next()
    } catch (error) {
      console.error("Invalid token:", error.message)
      return res.status(403).json({ message: "Invalid token."})
    }
}

app.post("/user/login", async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await Users.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign({userId: user._id, email: user.email, role: "user" }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({user: {
      userId: user._id,
      name: user.name,
      email: user.email,
    }, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
})
//signup
app.post("/user/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await Users.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    const newUser = new Users({ name, email, password });
    const savedUser = await newUser.save();

    res.status(201).json({ message: "User created successfully.", savedUser });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Failed to create user. Try again." });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

//multer
const storage = multer.diskStorage({})
const upload = multer({ storage })

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
       const file = req.file
       if(!file) return res.status(400).send("No file uploaded.")

          const result = await cloudinary.uploader.upload(file.path, {
              folder: "uploads",
          })

          const newImage = new ImageModel({ imageUrl: result.secure_url })
          await newImage.save()

          res.status(200).json({
              message: "Image uploaded successfully",
              imageUrl: result.secure_url,
              imageId: newImage._id
          })
  } catch (error){
      res.status(500).json({ message: "Image upload failed", error: error })
  }
})

app.get("/images", async (req, res) => {
  try{
    const images = await ImageModel.find()
    res.status(200).json(images)
  } catch(error){
      console.error(error)
      res.status(500).json({message: "Failed to fetch images", error: error})
  }
})
//create a new post
app.post("/user/post", verifyJWT, async (req, res) => {
    const { title, content, likes, media } = req.body
    const userId = req.user.userId;
    try{
       const newPost = new Posts({ title, content, likes, user: new mongoose.Types.ObjectId(userId), media: media ? new mongoose.Types.ObjectId(media) : null })
       await newPost.save()

       await Users.findByIdAndUpdate(
          userId,
          { $push: { post: newPost._id } },
          { new: true }
      );
       res.status(201).json({message: "Post added successfully.", data: { post: newPost }})
    } catch(error){
        console.error("Error creating post", error)
    }
})

// to get all posts
app.get("/posts", verifyJWT, async (req, res) => {
    try{
       const posts = await Posts.find().populate("user", "name",).populate("media", "imageUrl")
       res.json({ data: {posts} })
    } catch(error){
        console.error("Error fetching posts:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// to get a post by id
app.get("/posts/:postId", verifyJWT, async (req, res) => {
    const { postId } = req.params
    try{
      const post = await Posts.findById(postId).populate("user", "name").populate("media", "imageUrl")
      if(!post){
        return res.status(404).json({ error: "Post not found." })
      }
      res.json({ data: { post } })
    } catch(error){
        res.status(500).json({ error: "Internal server error." })
    }
})

//to update a post
app.put("/posts/edit/:postId", verifyJWT, async (req, res) => {
    const { postId } = req.params
    const {title, content, likes, like, createdAt, user, media} = req.body
    try{
     const updatedPost = await Posts.findByIdAndUpdate(postId, {title, content, likes, like, createdAt, user: new mongoose.Types.ObjectId(user), media}, {new: true, runValidators: true})
     if(!updatedPost){
        return res.status(404).json({ error: "Post not found." })
     }
     res.json({ data: { post: updatedPost } })
    } catch(error){
        console.error("Error updating post:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

//to delete a post by ID
app.delete("/user/posts/:postId", verifyJWT, async (req, res) => {
    const { postId } = req.params;
    try {
      const deletedPost = await Posts.findByIdAndDelete(postId);
      if (!deletedPost) {
        return res.status(404).json({ error: "Post not found." });
      }
      res.json({ message: "Post deleted successfully.", data: { post: deletedPost } });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  //to like a post by ID
app.post("/posts/like/:postId", async (req, res) => {
    const { postId } = req.params;
    try {
      const post = await Posts.findById(postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found." });
      }
      post.like = !post.like
      post.likes = post.like
      ? (post.likes || 0) + 1
      : Math.max((post.likes || 0) - 1, 0);

      const updatedPost = await post.save();

    res.json({ data: { post: updatedPost } });
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  //users routes
  //to add a user
  app.post("/users", async (req, res) => {
    try {
       const {name, picture, bio, following, post} = req.body
       const newUser = new Users({name, picture,bio, following, post: new mongoose.Types.ObjectId(post),})
       const savedUser = await newUser.save()
       res.status(201).json({message: "User added successfully", data: {user: savedUser}})
    } catch (error){
      console.error("Error fetching users:", error)
      res.status(500).json({error: "Internal server error"})
    }
  })

  //to get all Users
  app.get("/users", verifyJWT, async (req, res) => {
    try {
       const users = await Users.find().populate("post", "content",)
       res.json({data: { users }})
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error" });
  }
  })
  //update a user
  app.put("/users/:userId", verifyJWT, async (req, res) => {
    const { userId } = req.params
    const updateddata = req.body
    try{
    const updatedUser = await Users.findByIdAndUpdate(userId, updateddata, {new: true,
      runValidators: true,}) 
      if(!updatedUser){
        return res.status(404).json({ error: "User not found." });
      }
      res.json({data: {user: updatedUser}})
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
  }
  })
  //follow a user
  app.post("/users/follow/:followUserId", verifyJWT, async (req, res) => {
    try {
      const { id } = req.body; 
      const { followUserId } = req.params; 
  
      if (id === followUserId) {
        return res.status(400).json({ error: "You cannot follow yourself." });
      }
  
      const followUser = await Users.findById(followUserId);
  
      if (!followUser) {
        return res.status(404).json({ error: "User not found." });
      }
  
      if (followUser.following) {
        return res.status(400).json({ error: "User is already followed." });
      }
  
      followUser.following = true;
      await followUser.save();
  
      res.status(200).json({ message: "Followed successfully." });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });
  
  //unfollow a user
  app.post("/users/unfollow/:followUserId", verifyJWT, async (req, res) => {
    try {
      const { id } = req.body; //id of the user performing the action
      const { followUserId } = req.params; //id of target user
  
      if (id === followUserId) {
        return res.status(400).json({ error: "You cannot unfollow yourself." });
      }
  
      const followUser = await Users.findById(followUserId);
  
      if (!followUser) {
        return res.status(404).json({ error: "User not found." });
      }
  
      if (!followUser.following) {
        return res.status(400).json({ error: "User is not currently followed." });
      }
  
      // Set `isFollowed` to false
      followUser.following = false;
      await followUser.save();
  
      res.status(200).json({ message: "Unfollowed successfully." });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  // add post to bookmarks
  app.post("/users/bookmark/:postId", verifyJWT, async (req, res) => {
    try {
      const { postId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ error: "Invalid userId or postId." });
      }
      const post = await Posts.findById(postId);
      if (!post) {
        return res.status(404).json({ error: "post not found." });
      }
    const existingBookmark = await Bookmark.findOne({ post: postId });
    if (existingBookmark) {
      return res.status(400).json({ error: "Post is already bookmarked." });
    }
    
      const newBookmark = new Bookmark({ post: postId });
      await newBookmark.save();
    
      res.status(200).json({ message: "Post bookmarked successfully.", data: newBookmark});
    } catch (error) {
      console.error("Error bookmarking post:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });
// remove from bookmarks
app.delete("/users/remove-bookmark/:postId", verifyJWT, async (req, res) => {
  try {
    const { postId } = req.params; 

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: "Invalid userId or postId." });
    }

    const bookmark = await Bookmark.findOneAndDelete({ post: postId });
    if (!bookmark) {
      return res.status(404).json({ error: "Bookmark not found." });
    }

    res.status(200).json({
      message: "Bookmark removed successfully.",
    });

  } catch (error) {
    console.error("Error unbookmarking post:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
//to get all bookmarks
app.get("/users/bookmarks", verifyJWT, async (req, res) => {
  try {

    const bookmarks = await Bookmark.find().populate("post");
   
    res.status(200).json({
      message: "Bookmarks fetched successfully.",
      data: bookmarks,
    });
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

  

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
})