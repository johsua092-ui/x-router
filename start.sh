docker stop xrouter
docker rm xrouter
docker build -t xrouter .
docker run -d --name xrouter -p 20128:20128 --env-file .env -v xrouter-data:/app/data xrouter