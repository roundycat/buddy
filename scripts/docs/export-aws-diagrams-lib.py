"""
Generate Beddy AWS architecture diagram using the `diagrams` library
(same engine as AWS Diagram MCP Server).
"""
import os
from pathlib import Path

# Ensure Graphviz is on PATH (Windows)
os.environ["PATH"] = r"C:\Program Files\Graphviz\bin;" + os.environ.get("PATH", "")

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import ECS, ECR
from diagrams.aws.network import ELB, CloudFront
from diagrams.aws.database import Dynamodb
from diagrams.aws.storage import S3
from diagrams.aws.ml import Bedrock
from diagrams.aws.management import Cloudwatch
from diagrams.aws.security import SecretsManager
from diagrams.aws.integration import Eventbridge
from diagrams.onprem.client import User

OUT = Path(__file__).resolve().parents[1] / "docs" / "aws-mcp-style-bedi-architecture"
OUT.parent.mkdir(parents=True, exist_ok=True)

with Diagram(
    "Beddy — Admission to Discharge (LLM / Agent / RAG)",
    filename=str(OUT),
    outformat="png",
    show=False,
    direction="LR",
    graph_attr={
        "fontsize": "20",
        "bgcolor": "white",
        "pad": "0.4",
        "splines": "ortho",
    },
):
    child = User("Child")
    parent = User("Guardian")

    with Cluster("Edge"):
        cf = CloudFront("CloudFront\n(optional HTTPS)")
        alb = ELB("ALB\nbedi-alb :80")

    with Cluster("Compute — us-east-1"):
        ecr = ECR("ECR\nbedi-app")
        ecs = ECS("ECS Fargate\nbedi-service")

    with Cluster("Data"):
        ddb = Dynamodb("DynamoDB\nBediApp")
        s3 = S3("S3\nmedia + kb-summaries/")

    with Cluster("AI"):
        bedrock = Bedrock("Bedrock\nConverse / Guardrails / KB")

    with Cluster("Ops"):
        eb = Eventbridge("EventBridge\ndawn cron 05:00 KST")
        secrets = SecretsManager("Secrets Manager\nbedi/app")
        cw = Cloudwatch("CloudWatch\nBeddy metrics/logs")

    # Users → edge → app
    child >> Edge(label="chat / garden / mission") >> cf
    parent >> Edge(label="home / report Q") >> cf
    cf >> alb >> ecs
    ecr >> ecs

    # App ↔ data/ai
    ecs >> Edge(label="LLM chat (Haiku)", color="#2563eb") >> bedrock
    ecs >> Edge(label="state") >> ddb
    ecs >> Edge(label="media / KB docs") >> s3
    ecs >> secrets
    ecs >> cw

    # Dawn batch: Agent + RAG docs
    eb >> Edge(label="/api/cron/daily\nMission Agent + KB index", color="#c2410c") >> ecs
    ecs >> Edge(label="Agent tools:\nguidance cards +\nrecent titles", color="#c2410c") >> ddb
    ecs >> Edge(label="write summary MD\n(memory/emotion/...)", color="#0e7490") >> s3

    # Parent RAG
    parent >> Edge(label="RAG question", color="#7e22ce", style="dashed") >> alb
    ecs >> Edge(label="KB retrieve\n+ Bridge filter", color="#7e22ce") >> bedrock
    s3 >> Edge(label="kb-summaries/{childId}/", color="#7e22ce", style="dashed") >> bedrock

print(f"wrote {OUT}.png")
