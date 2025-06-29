## Available Scripts

### `npm start`

Runs all microservices in development mode using `concurrently`.  
Each service will start in its own terminal process, allowing you to develop and monitor them simultaneously.

By default, the following services will be started:

- UserService
- MovieService
- TheaterService
- ScheduleService
- BookingService
- PaymentService
- FoodService
- PromotionService

Each service should expose its own port (e.g., 3001, 3002, ...).  
Open their respective `http://localhost:[port]` to interact with them via browser or API tools like Postman.

The services will reload automatically when you make changes (if `nodemon` is used).  
You may also see any errors or logs in the console output of each service.

