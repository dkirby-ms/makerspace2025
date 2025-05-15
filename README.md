# Makerspace 2025

## Setup guide (Debian)

sudo bash -c "$(wget -O - https://apt.llvm.org/llvm.sh)"
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh

git clone --recursive https://github.com/microsoft/BitNet.git
cd BitNet

conda create -n bitnet-cpp python=3.9
conda activate bitnet-cpp

pip install -r requirements.txt

### Manually download the model and run with local path

huggingface-cli download microsoft/BitNet-b1.58-2B-4T-gguf --local-dir models/BitNet-b1.58-2B-4T
python setup_env.py -md models/BitNet-b1.58-2B-4T -q i2_s
