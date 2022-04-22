FROM node:14.8.0-alpine
RUN apk add --no-cache bash --virtual .build-deps alpine-sdk python3
# --no-cache makes docker container more lightweight
# --virtual flag keep other packages temporary
RUN npm install -g npm@6.14.7
RUN mkdir -p /var/www/user
WORKDIR /var/www/user
ADD . /var/www/user
RUN npm install
COPY wait-for-it.sh /usr/local/bin/wait-for-it 
# wait-for-it - will wait for the other container to startup
RUN chmod +x /usr/local/bin/wait-for-it
CMD npm start
