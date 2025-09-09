resource "aws_lb" "alb" {
  name               = "maatra-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = [
    aws_subnet.public_a.id,
    aws_subnet.public_b.id,
  ]
  security_groups    = [aws_security_group.alb_sg.id]
}

resource "aws_lb_target_group" "nextjs_tg" {
  name        = "maatra-nextjs-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.maatra.id
  target_type = "ip"
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.nextjs_tg.arn
  }
}
