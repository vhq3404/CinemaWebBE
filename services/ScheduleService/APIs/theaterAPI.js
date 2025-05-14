//theaterAPI
const axios = require("axios");

const THEATER_SERVICE_BASE_URL = "http://localhost:5002/api";

async function fetchRoomsByTheater(theaterId) {
  try {
    const response = await axios.get(`${THEATER_SERVICE_BASE_URL}/rooms/theater/${theaterId}`);
    return response.data;
  } catch (err) {
    console.error("Lỗi khi gọi API phòng từ TheaterService:", err.message);
    return [];
  }
}

module.exports = { fetchRoomsByTheater };
