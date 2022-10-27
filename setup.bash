cd ~
mkdir -p "bin"
cd bin
wget "http://cs.drexel.edu/~ndi26/bin/tranqc"
wget "http://cs.drexel.edu/~ndi26/bin/tranquility"
cd ~
wget "http://cs.drexel.edu/~ndi26/tvm.js"
cd bin
chmod +x ./tranqc
chmod +x ./tranquility
rm -- "$0"
