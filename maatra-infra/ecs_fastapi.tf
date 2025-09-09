# CloudWatch Log Group for FastAPI
resource "aws_cloudwatch_log_group" "fastapi" {
  name              = "/ecs/maatra-fastapi"
  retention_in_days = 7
}

# ECS Cluster
resource "aws_ecs_cluster" "maatra_cluster" {
  name = "maatra-cluster"
}

# Cloud Map DNS Namespace
resource "aws_service_discovery_private_dns_namespace" "maatra_ns" {
  name        = "maatra.local"
  vpc         = aws_vpc.maatra.id
  description = "Private namespace for service discovery"
}

# ECS Task Definition - FastAPI Backend
resource "aws_ecs_task_definition" "fastapi" {
  family                   = "maatra-fastapi-task-def"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = "fastapi-backend",
      image        = "${aws_ecr_repository.fastapi_backend.repository_url}:latest",
      portMappings = [
        {
          containerPort = 8000,
          hostPort      = 8000,
          protocol      = "tcp"
        }
      ],
      environment = [
        {
          name  = "AWS_REGION_NAME",
          value = var.bedrock_region
        },
        {
          name  = "AWS_ACCESS_KEY_ID",
          value = var.aws_access_key_id
        },
        {
          name  = "AWS_SECRET_ACCESS_KEY",
          value = var.aws_secret_access_key
        }
      ],
      essential = true,
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = "/ecs/maatra-fastapi",
          "awslogs-region"        = var.region,
          "awslogs-stream-prefix" = "fastapi"
        }
      }
    }
  ])

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
}

# ECS Service - FastAPI Backend
resource "aws_ecs_service" "fastapi_service" {
  name            = "maatra-fastapi-service"
  cluster         = aws_ecs_cluster.maatra_cluster.id
  task_definition = aws_ecs_task_definition.fastapi.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  force_new_deployment = true

  network_configuration {
    subnets         = [aws_subnet.public_a.id, aws_subnet.public_b.id]
    security_groups = [aws_security_group.fastapi_sg.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.fastapi.arn
  }

  depends_on = [aws_lb.alb]
}

# Service Discovery - FastAPI Backend
resource "aws_service_discovery_service" "fastapi" {
  name = "fastapi-backend-service"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.maatra_ns.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }

}
