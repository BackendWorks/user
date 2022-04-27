FROM node:14.16.0-alpine
RUN apk add --no-cache --virtual .build-deps alpine-sdk python3
RUN mkdir -p /var/www/user
WORKDIR /var/www/user
ADD . /var/www/user
RUN npm install
CMD npm start
