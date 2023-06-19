const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
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

// JSON Web Token Verification
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access!" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access!" });
    }
    req.decoded = decoded;
    next();
  });
};


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
    // await client.connect();

    const userCollection = client.db("languageSchoolDB").collection("users");
    const classCollection = client.db("languageSchoolDB").collection("classes");
    const bookingCollection = client.db("languageSchoolDB").collection("bookings");

    // JWT Token Creation
    app.post("/jwt", (req, res) => {
      const user = req.body;
      // console.log("User: ", user);

      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      // console.log("Token: ", token);
      res.send({ token });
    });

    // security layer: verifyJWT
    // email same
    // check admin
    // app.get("/users/admin/:email", verifyJWT, async (req, res) => {
    //   const email = req.params.email;

    //   if (req.decoded.email !== email) {
    //     res.send({ admin: false });
    //   }

    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   const result = { admin: user?.role === "admin" };
    //   res.send(result);
    // });

    // verifyAdmin (Warning: use verifyJWT before using verifyAdmin)
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Access forbidden!" });
      }
      next();
    };

    // verifyInstructor (Warning: use verifyJWT before using verifyInstructor)
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "Access forbidden!" });
      }
      next();
    };

    // Save User Information and Role in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      // console.log(user);

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
      // console.log("New Class Details: ", bookingDetails);
      const result = await classCollection.insertOne(bookingDetails); // Documentation: https://www.mongodb.com/docs/drivers/node/current/usage-examples/insertOne/
      res.send(result);
    });

    // Book a Class
    app.post("/book-a-class", async (req, res) => {
      const classDetails = req.body;
      const classId = classDetails.class_id;
      const query = { class_id: classId };
      const existingBooking = await bookingCollection.findOne(query);
      if (existingBooking) {
        return res.send({ message: "You have already booked this course!" });
      }

      const result = await bookingCollection.insertOne(classDetails); // Documentation: https://www.mongodb.com/docs/drivers/node/current/usage-examples/insertOne/
      res.send(result);
    });

    // Delete a Booking Data
    app.delete("/delete-booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log("Detele Query Details: ", id, query);
      const result = await bookingCollection.deleteOne(query); // Documentation: https://www.mongodb.com/docs/drivers/node/current/usage-examples/insertOne/
      res.send(result);
    });

    // Make Payment
    app.patch("/make-payment/:id", async (req, res) => {
      const bookingId = req.params.id;
      const classId = req.query.classId;
      
      const classFilter = { _id: new ObjectId(classId) };
      const updateSeat = { $inc: { available_seats: -1, enrolled_students: 1 } };
      
      const getClassSeats = await classCollection.findOne(classFilter);
      if(getClassSeats.available_seats == 0) {
        return res.send({ message: "No seat available in this course!" });
      }
      else {
        const updateClassResult = await classCollection.updateOne(classFilter, updateSeat);

        const bookingFilter = { _id: new ObjectId(bookingId) };
        const updateBooking = { $set: { payment_status: "paid" } };
        
        if (updateClassResult.modifiedCount === 1) {
          const updateBookingResult = await bookingCollection.updateOne(bookingFilter, updateBooking);
          res.send({ updateClassResult, updateBookingResult });
        } 
        else {
          res.send({message: "Failed to update class information!"});
        }
      }
    });

    // My Selected Classes for Students
    app.get("/my-selected-classes/:email", async (req, res) => {
      const email = req.params.email;
      // console.log("my-classes email:", email);
      const query = { student_email: email, payment_status: "unpaid" };

      // const project = {
      //   student_name: 0,
      //   student_email: 0,
      //   student_image: 0,
      //   class_id: 0,
      //   available_seats: 0,
      //   enrolled_students: 0,
      // };

      // const result = await bookingCollection.find(query).project(project).toArray();

      const result = await bookingCollection
        .aggregate([
          {
            $match: query,
          },
          {
            $addFields: {
              classId: {
                $toObjectId: "$class_id",
              },
            },
          },
          {
            $lookup: {
              from: "classes",
              localField: "classId",
              foreignField: "_id",
              as: "classDetails",
            },
          },
          {
            $project: {
              _id: 1,
              // student_name: 1,
              // student_email: 1,
              // student_image: 1,
              // class_id: 1,
              class_name: { $arrayElemAt: ["$classDetails.class_name", 0] },
              class_image: { $arrayElemAt: ["$classDetails.class_image", 0] },
              instructor_name: {
                $arrayElemAt: ["$classDetails.instructor_name", 0],
              },
              instructor_email: {
                $arrayElemAt: ["$classDetails.instructor_email", 0],
              },
              available_seats: {
                $arrayElemAt: ["$classDetails.available_seats", 0],
              },
              enrolled_students: {
                $arrayElemAt: ["$classDetails.enrolled_students", 0],
              },
              class_price: {
                $arrayElemAt: ["$classDetails.class_price", 0],
              },
              // class_price: 1,
              payment_status: 1,
            },
          },
        ])
        .toArray();

      // console.log("Selected Classes: ", resultWithAggregate);
      // res.send(resultWithAggregate);

      res.send(result);
    });

    // My Enrolled Classes for Students
    app.get("/my-enrolled-classes/:email", async (req, res) => {
      const email = req.params.email;
      // console.log("my-classes email:", email);
      const query = { student_email: email, payment_status: "paid" };

      const project = {
        student_name: 0,
        student_email: 0,
        student_image: 0,
        class_id: 0,
        available_seats: 0,
        enrolled_students: 0,
      };

      const result = await bookingCollection
        .find(query)
        .project(project)
        .toArray();
      res.send(result);
    });

    // Payment History for Students
    app.get("/payment-history/:email", async (req, res) => {
      const email = req.params.email;
      // console.log("payment history email:", email);
      const query = { student_email: email, payment_status: "paid" };

      const project = {
        student_name: 0,
        student_email: 0,
        student_image: 0,
        class_id: 0,
        available_seats: 0,
        enrolled_students: 0,
      };

      const result = await bookingCollection
        .find(query)
        .project(project)
        .toArray();
      res.send(result);
    });

    // Get User Information (to set role in Auth Provider)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
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
      // console.log("my-classes email:", email);
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

    // Get All Instructor's Information
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    /******* ADMIN *******/
    // Get All User Information
    app.get("/admin/manage-users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Update User's Role to Admin
      app.patch("/admin/make-admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
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
      }
    );

    // Update User's Role to Instructor
    app.patch("/admin/make-instructor/:id", verifyJWT, verifyAdmin, async (req, res) => {
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
      }
    );

    // Get All Class Information
    app.get("/admin/manage-classes", verifyJWT, verifyAdmin, async (req, res) => {
        const result = await classCollection.find().toArray();
        res.send(result);
      }
    );

    // Update Class Status as Approved
    app.patch("/admin/approve-class/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log("Check Class ID: ", id);
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
    app.patch("/admin/deny-class/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log("Check Class ID: ", id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          class_status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send Feedback
    app.patch("/admin/send-feedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
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

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    client.db("admin").command({ ping: 1 });
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
