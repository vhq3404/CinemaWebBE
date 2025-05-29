const axios = require("axios");
require("dotenv").config(); // Đảm bảo biến môi trường được load

const MOVIE_SERVICE_BASE_URL = process.env.MOVIE_SERVICE_BASE_URL;

// Hàm gọi API từ MovieService để lấy thông tin phim
async function fetchMovieById(movieId) {
  try {
    const response = await axios.get(`${MOVIE_SERVICE_BASE_URL}/${movieId}`, {
      timeout: 3000,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      console.error(`MovieService trả lỗi: ${err.response.status} - ${err.response.data?.error || err.message}`);
    } else if (err.code === "ECONNABORTED") {
      console.error("MovieService request timeout");
    } else {
      console.error("Lỗi khi gọi API MovieService:", err.message);
    }
    return null;
  }
}

module.exports = { fetchMovieById };
