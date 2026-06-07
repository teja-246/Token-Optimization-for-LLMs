package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load()

	if err != nil {
		log.Fatal("failed to load .env")
	}

	secret := os.Getenv("JWT_SECRET")

	if secret == "" {
		log.Fatal("JWT_SECRET missing")
	}

	claims := jwt.MapClaims{
		"user_id": "u42",
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(secret))

	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(tokenString)
}