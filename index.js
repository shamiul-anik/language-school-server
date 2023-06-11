const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Language School is Running!");
});

app.listen(port, () => {
  console.log(`Language School Server is running on port ${port}`);
});
