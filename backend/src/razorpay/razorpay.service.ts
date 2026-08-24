import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class RazorpayService {
  private readonly keyId =
    process.env.RAZORPAY_KEY_ID;

  private readonly keySecret =
    process.env.RAZORPAY_KEY_SECRET;

  async getOrder(orderId: string) {
    if (!this.keyId || !this.keySecret) {
      throw new InternalServerErrorException(
        'Razorpay credentials are not configured.',
      );
    }

    const credentials =
      Buffer.from(
        `${this.keyId}:${this.keySecret}`,
      ).toString('base64');

    const response = await fetch(
      `https://api.razorpay.com/v1/orders/${orderId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      throw new InternalServerErrorException(
        `Razorpay API request failed: ${errorBody}`,
      );
    }

    return response.json();
  }
}