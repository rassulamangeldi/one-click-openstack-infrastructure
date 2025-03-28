FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        curl \
        git \
        openssh-client \
        sudo \
        software-properties-common \
        gnupg \
        vim \
        nano && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir ansible-core==2.17.*

WORKDIR /ansible

COPY . /ansible

CMD ["bash"]