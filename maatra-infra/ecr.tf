resource "aws_ecr_repository" "fastapi_backend" {
  name = "maatra/fastapi-backend"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "maatra-fastapi-backend"
  }
}

resource "aws_ecr_repository" "nextjs_frontend" {
  name = "maatra/nextjs-frontend"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "maatra-nextjs-frontend"
  }
}
