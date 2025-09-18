import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable } from '@nestjs/common'
import { RealtimeService } from './realtime.service'

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:4001', 
      'https://admin.klk1.store',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true
  }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private connectedClients = new Set<Socket>()

  constructor(private readonly realtimeService: RealtimeService) {}

  handleConnection(client: Socket) {
    console.log(`클라이언트 연결: ${client.id}`)
    this.connectedClients.add(client)
    
    // 연결 시 즉시 데이터 전송
    this.sendRealtimeData(client)
  }

  handleDisconnect(client: Socket) {
    console.log(`클라이언트 연결 해제: ${client.id}`)
    this.connectedClients.delete(client)
  }

  @SubscribeMessage('subscribe-realtime')
  async handleSubscribeRealtime(client: Socket) {
    console.log(`실시간 구독 요청: ${client.id}`)
    await this.sendRealtimeData(client)
  }

  @SubscribeMessage('unsubscribe-realtime')
  handleUnsubscribeRealtime(client: Socket) {
    console.log(`실시간 구독 해제: ${client.id}`)
  }

  private async sendRealtimeData(client: Socket) {
    try {
      const data = await this.realtimeService.getRealtimeData()
      client.emit('realtime-update', data)
    } catch (error) {
      console.error('실시간 데이터 전송 실패:', error)
      client.emit('realtime-error', { message: '데이터 조회 실패' })
    }
  }

  // 주기적으로 모든 클라이언트에 데이터 전송
  async broadcastRealtimeData() {
    if (this.connectedClients.size === 0) return

    try {
      const data = await this.realtimeService.getRealtimeData()
      this.server.emit('realtime-update', data)
    } catch (error) {
      console.error('실시간 데이터 브로드캐스트 실패:', error)
    }
  }
}
