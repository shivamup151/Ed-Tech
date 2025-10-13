#!/bin/bash
# Install system dependencies
apt-get update && apt-get install -y \
    libreoffice \
    imagemagick \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
pip install -r requirements.txt
