FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -o /server ./cmd/server

FROM alpine:3.20
COPY --from=build /server /server
COPY migrations /migrations
WORKDIR /
EXPOSE 8080
CMD ["/server"]
