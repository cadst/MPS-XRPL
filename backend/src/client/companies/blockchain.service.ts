import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, keccak256, solidityPacked } from 'ethers';
import { SMART_ACCOUNT_FACTORY_ABI } from './abi/SmartAccountFactory';
@Injectable()
export class BlockchainService {
    private readonly logger = new Logger(BlockchainService.name);
    private provider: ethers.JsonRpcProvider;
    private paymasterWallet: ethers.Wallet;
    private smartAccountFactory: ethers.Contract;

    constructor(private readonly config: ConfigService) {
        this.initializeProvider();
    }

    private initializeProvider() {
        try {
            const rpcUrl = this.config.get<string>('INFURA_RPC');
            const privateKey = this.config.get<string>('PRIVATE_KEY');
            const factoryAddress = this.config.get<string>('SmartAccountFactory');

            if (!rpcUrl || !privateKey || !factoryAddress) {
                throw new Error('블록체인 설정이 누락되었습니다. INFURA_RPC, PRIVATE_KEY, SmartAccountFactory를 확인하세요.');
            }

            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            this.paymasterWallet = new ethers.Wallet(privateKey, this.provider);
            this.smartAccountFactory = new ethers.Contract(
                factoryAddress,
                SMART_ACCOUNT_FACTORY_ABI,
                this.paymasterWallet
            );
        } catch (error) {
            this.logger.error('블록체인 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 이메일과 사업자번호로 개인키 생성 (createAccount.js의 로직과 동일)
     */
    private createPrivateKey(email: string, salt: string, businessNumber: string): string {
        const companyId = `${email}_${businessNumber}`;
        const value = solidityPacked(["string", "string"], [salt, companyId]).slice(0, 64);
        const pk = keccak256(value).replace("0x", "").slice(0, 64);
        return `0x${pk}`;
    }

    /**
     * EOA 주소에서 스마트 계정 주소 조회
     */
    async getSmartAccountAddress(ownerAddress: string): Promise<string> {
        try {
            return await this.smartAccountFactory.getAccount(ownerAddress);
        } catch (error) {
            this.logger.error('스마트 계정 주소 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 스마트 계정이 이미 존재하는지 확인
     */
    async isSmartAccountExists(ownerAddress: string): Promise<boolean> {
        try {
            const smartAccountAddress = await this.getSmartAccountAddress(ownerAddress);
            return smartAccountAddress !== ethers.ZeroAddress;
        } catch (error) {
            this.logger.error('스마트 계정 존재 여부 확인 실패:', error);
            return false;
        }
    }

    /**
     * 스마트 계정 생성
     */
    async createSmartAccount(email: string, businessNumber: string): Promise<{
        eoaAddress: string;
        smartAccountAddress: string;
        transactionHash?: string;
    }> {
        try {
            // 1. 개인키 생성 (고정 salt 사용)
            const salt = "dummy_salt"; // 실제로는 더 안전한 salt를 사용하거나 환경변수로 관리
            const privateKey = this.createPrivateKey(email, salt, businessNumber);

            // 2. EOA 지갑 생성
            const wallet = new ethers.Wallet(privateKey, this.provider);
            const ownerAddress = wallet.address;

            this.logger.log(`EOA 주소 생성: ${ownerAddress}`);

            // 3. 기존 스마트 계정 확인
            const existingSmartAccount = await this.getSmartAccountAddress(ownerAddress);

            if (existingSmartAccount !== ethers.ZeroAddress) {
                this.logger.log(`기존 스마트 계정 발견: ${existingSmartAccount}`);
                return {
                    eoaAddress: ownerAddress,
                    smartAccountAddress: existingSmartAccount,
                };
            }

            // 4. 새 스마트 계정 생성
            this.logger.log('새 스마트 계정 생성 중...');
            const transaction = await this.smartAccountFactory.createAccount(ownerAddress);
            const receipt = await transaction.wait();

            // 5. 생성된 스마트 계정 주소 조회
            const smartAccountAddress = await this.getSmartAccountAddress(ownerAddress);

            this.logger.log(`스마트 계정 생성 완료: ${smartAccountAddress}`);
            this.logger.log(`트랜잭션 해시: ${receipt.hash}`);

            return {
                eoaAddress: ownerAddress,
                smartAccountAddress,
                transactionHash: receipt.hash,
            };
        } catch (error) {
            this.logger.error('스마트 계정 생성 실패:', error);
            throw new Error(`스마트 계정 생성 중 오류가 발생했습니다: ${error.message}`);
        }
    }
}
