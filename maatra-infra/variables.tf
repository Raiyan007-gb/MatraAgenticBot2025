variable "region" {
  default = "ap-southeast-1" # Singapore, change this for deploy and test
                            # for example to deploy canada make it "ca-central-1"
}

variable "bedrock_region" {
  default = "ca-central-1" # Canada, if you change make sure bedrock API is enable that region. 
                            #Currently only canada central-1 region bedrock API is active
}

variable "aws_access_key_id" {
  description = "AWS access key for development"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret key for development"
  type        = string
  sensitive   = true
}
