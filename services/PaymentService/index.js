const express = require("express");
const app = express();
const paymentRoutes = require("./routes/paymentRoutes"); // import routes booking
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/payments", paymentRoutes);

// Lắng nghe server trên PORT
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`PaymentService is running on port ${PORT}`);
});
