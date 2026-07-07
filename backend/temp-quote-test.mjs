import { ethers } from 'ethers';

const routerAddr = '0xb2A2E40f508db5011Db7E3Afc271578F072F06A6';
const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/-toqbRFnhsVcSDoDFhcYk');
const abi = [
  'function getAmountsOut(uint256,address[]) view returns (uint256[])',
  'function WETH() view returns (address)',
];

(async () => {
  try {
    const router = new ethers.Contract(routerAddr, abi, provider);
    const weth = await router.WETH();
    console.log('router WETH', weth);
    const amountIn = ethers.parseUnits('0.01', 18);
    const path = ['0x2847EDD59BF140bF8633Cb9Fea8F8b076F51A1b7', '0x146BCC26aebdf585D69473b3D1D4E69c05f0dd9c'];
    console.log('path', path);
    const amountsOut = await router.getAmountsOut(amountIn, path);
    console.log('amountsOut', amountsOut.map((a) => a.toString()));
  } catch (err) {
    console.error('ERR', err);
  }
})();
