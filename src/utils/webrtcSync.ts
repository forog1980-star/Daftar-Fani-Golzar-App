import { SyncPackage } from '../types';

export type WirelessRole = 'idle' | 'sender' | 'receiver';
export type WirelessState =
  | 'idle'
  | 'gathering'
  | 'awaiting-peer'
  | 'connected'
  | 'transferring'
  | 'completed'
  | 'error';

// Serverless Local Direct Wireless Transfer via WebRTC DataChannel (Manual Offer/Answer code exchange over local Wi-Fi / hotspot)
export class DirectWirelessPeer {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private incomingChunks: string[] = [];
  private onStateChange: (state: WirelessState, message: string) => void;
  private onPackageReceived: (pkg: SyncPackage) => void;

  constructor(
    onStateChange: (state: WirelessState, message: string) => void,
    onPackageReceived: (pkg: SyncPackage) => void
  ) {
    this.onStateChange = onStateChange;
    this.onPackageReceived = onPackageReceived;
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timeout = setTimeout(resolve, 2500);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  private attachChannelHandlers(channel: RTCDataChannel) {
    this.dc = channel;
    channel.onopen = () => {
      this.onStateChange('connected', 'ارتباط مستقیم بی‌سیم برقرار شد. آماده ارسال یا دریافت بسته همگام‌سازی هستید.');
    };
    channel.onclose = () => {
      this.onStateChange('idle', 'کانال ارتباط مستقیم بسته شد.');
    };
    channel.onerror = () => {
      this.onStateChange('error', 'خطا در ارتباط مستقیم بی‌سیم. اتصال شبکه محلی دو دستگاه را بررسی کنید.');
    };
    channel.onmessage = (event) => {
      const msg = String(event.data);
      if (msg === '__SYNC_START__') {
        this.incomingChunks = [];
        this.onStateChange('transferring', 'در حال دریافت بسته همگام‌سازی از دستگاه مقابل...');
        return;
      }
      if (msg === '__SYNC_END__') {
        try {
          const fullJson = this.incomingChunks.join('');
          const pkg = JSON.parse(fullJson) as SyncPackage;
          this.onStateChange('completed', 'بسته همگام‌سازی دریافت شد و آماده بررسی تعارض‌ها است.');
          this.onPackageReceived(pkg);
        } catch {
          this.onStateChange('error', 'خطا در خواندن داده دریافت‌شده.');
        }
        return;
      }
      this.incomingChunks.push(msg);
    };
  }

  async createOfferCode(): Promise<string> {
    this.close();
    this.onStateChange('gathering', 'در حال ایجاد کد اتصال مستقیم...');
    const pc = new RTCPeerConnection({ iceServers: [] }); // Strictly local network, no cloud servers
    this.pc = pc;
    const channel = pc.createDataChannel('daftar-fani-sync', { ordered: true });
    this.attachChannelHandlers(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.waitForIceGathering(pc);

    this.onStateChange('awaiting-peer', 'کد اتصال ایجاد شد. آن را در دستگاه مقابل وارد کرده و کد پاسخ را اینجا ثبت کنید.');
    return btoa(unescape(encodeURIComponent(JSON.stringify(pc.localDescription))));
  }

  async acceptOfferAndCreateAnswerCode(offerCode: string): Promise<string> {
    this.close();
    this.onStateChange('gathering', 'در حال پردازش کد اتصال دستگاه مقابل...');
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    pc.ondatachannel = (ev) => {
      this.attachChannelHandlers(ev.channel);
    };

    const desc = JSON.parse(decodeURIComponent(escape(atob(offerCode.trim()))));
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.waitForIceGathering(pc);

    this.onStateChange('awaiting-peer', 'کد پاسخ تولید شد. آن را در دستگاه اول وارد کنید تا اتصال برقرار شود.');
    return btoa(unescape(encodeURIComponent(JSON.stringify(pc.localDescription))));
  }

  async completeConnectionWithAnswer(answerCode: string): Promise<void> {
    if (!this.pc) throw new Error('ابتدا کد اتصال ایجاد کنید.');
    const desc = JSON.parse(decodeURIComponent(escape(atob(answerCode.trim()))));
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));
  }

  sendSyncPackage(pkg: SyncPackage): void {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('اتصال مستقیم بی‌سیم هنوز برقرار نشده است.');
    }
    this.onStateChange('transferring', 'در حال ارسال مستقیم اطلاعات به دستگاه مقابل...');
    const serialized = JSON.stringify(pkg);
    const chunkSize = 14000;
    this.dc.send('__SYNC_START__');
    for (let i = 0; i < serialized.length; i += chunkSize) {
      this.dc.send(serialized.slice(i, i + chunkSize));
    }
    this.dc.send('__SYNC_END__');
    this.onStateChange('completed', 'بسته همگام‌سازی با موفقیت به دستگاه مقابل ارسال شد.');
  }

  close(): void {
    try {
      this.dc?.close();
      this.pc?.close();
    } catch {
      // ignore close errors
    }
    this.dc = null;
    this.pc = null;
  }
}
