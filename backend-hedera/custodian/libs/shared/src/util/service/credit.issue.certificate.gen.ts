import { FileHandlerInterface } from '@app/shared/file-handler/filehandler.interface';
import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface CreditIssueCertificateData {
    projectName: string;
    companyName: string;
    creditType: string;
    certificateNo: string;
    issueDate: string;
    monitoringStartDate: string;
    monitoringEndDate: string;
    issuedCredits: number;
}

@Injectable()
export class CreditIssueCertificateGenerator {
    constructor(private fileHandler: FileHandlerInterface) {}

    async generateCreditIssueCertificate(
        data: CreditIssueCertificateData,
        isPreview?: boolean,
    ): Promise<string> {
        const refFileName = data.certificateNo.replace(/\//g, '_');
        const fileName = `CREDIT_ISSUANCE_CERTIFICATE_${refFileName}.pdf`;
        const filePath = path.join(process.cwd(), 'public/documents', fileName);

        // Ensure directory exists
        const folderPath = path.dirname(filePath);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const track = 'Track I';
        const startImageX = (doc.page.width - (45 + 130 + 30)) / 2;
        const startImageY = 50;

        doc.registerFont('Inter', 'fonts/Inter-Regular.ttf');
        doc.registerFont('Inter-Bold', 'fonts/Inter-Bold.ttf');

        // doc.image('images/sri-lanka-emblem.png', startImageX, startImageY, {
        //     width: 45,
        //     height: 60,
        // });

        // doc.image('images/SLCCS_logo.png', startImageX + 45 + 15, startImageY, {
        //     width: 130,
        //     height: 65,
        // });

        doc.moveDown(2);
        doc.fontSize(30)
            .font('Inter-Bold')
            .fillColor('#1f4e79')
            .text('Credit Issuance Certificate', { align: 'center' });

        if (isPreview) this.addPreviewWatermark(doc);

        doc.moveDown(2).fontSize(16).fillColor('black');

        doc.font('Inter-Bold')
            .fontSize(14)
            .text('Sri Lanka Climate Fund (Pvt) Ltd', { align: 'center' });

        doc.moveDown(0.5)
            .font('Inter')
            .fontSize(12)
            .text('Issues', { align: 'center' });

        doc.moveDown(0.5)
            .font('Inter')
            .fontSize(12)
            .text('Zimbabwen Certified Emission Reductions (SCER)', {
                align: 'center',
            });

        doc.moveDown(0.5).text('for', { align: 'center' });

        doc.moveDown(0.5)
            .font('Inter-Bold')
            .fontSize(14)
            .text(`${data.projectName}`, { align: 'center' });

        doc.moveDown(0.5).text('of', { align: 'center' });

        doc.moveDown(0.5)
            .font('Inter')
            .fontSize(14)
            .text(`${data.companyName}`, { align: 'center' });

        doc.moveDown(0.5)
            .font('Inter')
            .fontSize(12)
            .text('registered under', { align: 'center' });

        doc.moveDown(0.5)
            .font('Inter-Bold')
            .fontSize(14)
            .text(`${track} of Sri Lanka Carbon Crediting Scheme`, {
                align: 'center',
            });

        doc.moveDown(1)
            .fontSize(11)
            .font('Inter-Bold')
            .text(`Certificate No: ${data.certificateNo}`, { align: 'left' })
            .moveDown(0.4)
            .text(`Date of issuance: ${data.issueDate}`, { align: 'left' })
            .moveDown(0.4)
            .text(
                `Monitoring Period: ${data.monitoringStartDate} - ${data.monitoringEndDate}`,
                { align: 'left' },
            )
            .moveDown(1);

        doc.font('Inter-Bold')
            .fontSize(16)
            .text(
                `Sri Lankan Credit Emission Reductions: ${data.issuedCredits} (tCO₂eq)`,
                { align: 'center' },
            )
            .moveDown(1.5);

        this.addSignatures(doc);

        doc.end();

        await new Promise<void>((resolve) => {
            stream.on('finish', resolve);
        });

        const content = fs.readFileSync(filePath, { encoding: 'base64' });

        return await this.fileHandler.uploadFile(
            `documents/${fileName}`,
            content,
        );
    }

    private addSignatures(doc: PDFKit.PDFDocument) {
        const chairmanSignature = 'public/signatures/chairman.jpg';
        const ceoSignature = 'public/signatures/ceo.jpg';

        if (fs.existsSync(chairmanSignature)) {
            doc.image(chairmanSignature, 110, 579, { width: 120, height: 100 });
        }

        doc.font('Inter')
            .fontSize(10)
            .text('...............................', 135, 660, {
                align: 'left',
            })
            .text('Chairman', 154, 675)
            .text('Zimbabwe Climate Fund (Pvt) Ltd.', 100, 690, {
                align: 'left',
            });

        // doc.image('images/SLCF_logo.jpg', 260, 600, {
        //     width: 110,
        //     height: 100,
        // });

        if (fs.existsSync(ceoSignature)) {
            doc.image(ceoSignature, 410, 579, { width: 120, height: 100 });
        }

        doc.font('Inter')
            .fontSize(10)
            .text('...............................', 415, 660, {
                align: 'left',
            })
            .text('Chief Executive Officer', 400, 675)
            .text('Zimbabwe Climate Fund (Pvt) Ltd.', 378, 690, {
                align: 'left',
            });

        doc.font('Inter')
            .fontSize(9)
            .text(
                "Zimbabwe Climate Fund (Pvt) Ltd, 'Sobadam Piyasa', No. 416/C/1, Robert Gunawardana Mawatha, Battaramulla.",
                70,
                720,
                { align: 'center' },
            )
            .text('Phone: 011 2053065  E-mail: info@climatefund.lk', 70, 730, {
                align: 'center',
            });
    }

    private addPreviewWatermark(doc: PDFKit.PDFDocument) {
        doc.save()
            .fontSize(160)
            .font('Helvetica-Bold')
            .opacity(0.1)
            .fillColor('grey')
            .rotate(35, { origin: [doc.page.width / 2, doc.page.height / 2] })
            .text('Preview', 0, doc.page.height / 2 - 100, {
                width: doc.page.width,
                align: 'center',
            })
            .restore();
    }
}
