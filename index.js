const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const jwt = require("jsonwebtoken");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
// app.use(cors());
app.use(express.json());
app.use(morgan("dev"));


const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@cluster0.s278t41.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("languageSchoolDB").collection("users");
    const classCollection = client.db("languageSchoolDB").collection("classes");
    const bookingCollection = client
      .db("languageSchoolDB")
      .collection("bookings");

    // Save User Information and Role in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      console.log(user);

      const query = { email: email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists!" });
      }

      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // Add a Class
    app.post("/add-a-class", async (req, res) => {
      const bookingDetails = req.body;
      console.log("New Class Details: ", bookingDetails);
      const result = await classCollection.insertOne(bookingDetails); // Documentation: https://www.mongodb.com/docs/drivers/node/current/usage-examples/insertOne/
      res.send(result);
    });

    // Book a Class
    app.post("/book-a-class", async (req, res) => {
      const classDetails = req.body;
      console.log("New Class Details: ", classDetails);

      // const classId = classDetails.class_id;
      // console.log("Class ID of Class Details: ", classId);
      // const query = { _id: ObjectId(classId) };
      // console.log("Query : ", query);
      // const existingBooking = await classCollection.findOne(query);
      // console.log("Existing Booking: ", existingBooking);
      // if (existingBooking) {
      //   return res.send({ message: "You have already booked this course!" });
      // }

      const result = await bookingCollection.insertOne(classDetails); // Documentation: https://www.mongodb.com/docs/drivers/node/current/usage-examples/insertOne/
      res.send(result);
    });

    // Delete a Booking Data
    app.delete("/delete-booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log("Detele Query Details: ", id, query);
      const result = await bookingCollection.deleteOne(query); // Documentation: https://www.mongodb.com/docs/drivers/node/current/usage-examples/insertOne/
      res.send(result);
    });

    // Update Class Status as Approved
    app.patch("/payment/:id", async (req, res) => {
      const id = req.params.id;
      console.log("Check Booking ID for Payment: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          payment_status: "paid",
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // My Selected Classes for Students
    app.get("/my-selected-classes/:email", async (req, res) => {
      const email = req.params.email;
      console.log("my-classes email:", email);
      const query = { student_email: email, payment_status: "unpaid" };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // My Enrolled Classes for Students
    app.get("/my-enrolled-classes/:email", async (req, res) => {
      const email = req.params.email;
      console.log("my-classes email:", email);
      const query = { student_email: email, payment_status: "paid" };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Get User Information (to set role in Auth Provider)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Get All Class Information
    // TODO: verifyJWT and verifyAdmin
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // Get Approved Classes
    app.get("/classes/approved", async (req, res) => {
      const query = { class_status: "approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // Get Popular Classes
    app.get("/popular-classes", async (req, res) => {
      const query = { class_status: "approved" };
      const result = await classCollection
        .find(query)
        .sort({ enrolled_students: "desc" })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // My Classes for Instructors
    app.get("/my-classes/:email", async (req, res) => {
      const email = req.params.email;
      console.log("my-classes email:", email);
      const query = { instructor_email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // Get Popular Instructors
    app.get("/popular-instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).limit(6).toArray();
      res.send(result);
    });

    // Update Class Status as Approved
    app.patch("/class/approved/:id", async (req, res) => {
      const id = req.params.id;
      console.log("Check Class ID: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          class_status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Update Class Status as Denied
    app.patch("/class/denied/:id", async (req, res) => {
      const id = req.params.id;
      console.log("Check Class ID: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          class_status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Add Feedback
    app.patch("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const { admin_feedback } = req.body;
      // console.log("Check Feedback ID: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          admin_feedback: admin_feedback,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Get All User Information
    // TODO: verifyJWT and verifyAdmin
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get All Instructor's Information
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
    //   const result = await usersCollection.find().toArray();
    //   res.send(result);
    // });

    // Update User's Role to Admin
    app.patch("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      // console.log("Check ID Admin: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Update User's Role to Instructor
    app.patch("/user/instructor/:id", async (req, res) => {
      const id = req.params.id;
      // console.log("Check ID Instructor: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You are successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Language School is Running!");
});

app.listen(port, () => {
  console.log(`Language School Server is running on port ${port}`);
});
