import { Injectable } from '@nestjs/common';
import { FileHandlerInterface } from './filehandler.interface';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

@Injectable()
export class LocalFileHandlerService implements FileHandlerInterface {
    constructor(private configService: ConfigService) {}

    public async uploadFile(
        filePath: string,
        content: string,
    ): Promise<string> {
        const baseUrl = this.configService.get<string>('backendHost');
        const fullPath = path.join(process.cwd(), 'public/uploads', filePath);

        const folderPath = path.dirname(fullPath);
        if (!fsSync.existsSync(folderPath)) {
            fsSync.mkdirSync(folderPath, { recursive: true });
        }

        await fs.writeFile(fullPath, content, 'base64');

        return `${baseUrl}/uploads/${filePath}`;
    }

    public async getUrl(filePath: string) {
        const baseUrl = this.configService.get<string>('backendHost');
        return `${baseUrl}/uploads/${filePath}`;
    }
}
