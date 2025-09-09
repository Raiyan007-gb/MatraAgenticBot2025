# CloudWatch Log Group for Next.js
resource "aws_cloudwatch_log_group" "nextjs" {
  name              = "/ecs/maatra-nextjs"
  retention_in_days = 7
}

# ECS Task Definition - Next.js Frontend
resource "aws_ecs_task_definition" "nextjs" {
  family                   = "maatra-nextjs-task-def"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = "nextjs-frontend",
      image        = "${aws_ecr_repository.nextjs_frontend.repository_url}:latest",
      portMappings = [
        {
          containerPort = 3000,
          hostPort      = 3000,
          protocol      = "tcp"
        }
      ],
      environment = [
        {
          name  = "BACKEND_URL",
          value = "http://fastapi-backend-service.maatra.local:8000"
        }
      ],
      essential = true,
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          "awslogs-group"         = "/ecs/maatra-nextjs",
          "awslogs-region"        = var.region,
          "awslogs-stream-prefix" = "nextjs"
        }
      }
    }
  ])

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }
}

# ECS Service - Next.js Frontend
resource "aws_ecs_service" "nextjs_service" {
  name            = "maatra-nextjs-service"
  cluster         = aws_ecs_cluster.maatra_cluster.id
  task_definition = aws_ecs_task_definition.nextjs.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  force_new_deployment = true

  network_configuration {
    subnets         = [aws_subnet.public_a.id, aws_subnet.public_b.id]  # Updated to use both subnets
    security_groups = [aws_security_group.nextjs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.nextjs_tg.arn
    container_name   = "nextjs-frontend"
    container_port   = 3000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.nextjs.arn
  }

  depends_on = [aws_lb_listener.http]
}

# Service Discovery - Next.js Frontend
resource "aws_service_discovery_service" "nextjs" {
  name = "nextjs-frontend-service"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.maatra_ns.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
}
