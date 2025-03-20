import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { FileHandlerInterface } from '@app/shared/file-handler/filehandler.interface';

@Injectable()
export class AuthorisationLetterGenerateService {
    constructor(
        private configService: ConfigService,
        private fileHandler: FileHandlerInterface,
    ) {}

    async generateLetter(
        programmeId: string,
        programmeName: string,
        authorisedCompanyName: string,
        orgs: string[],
    ): Promise<string> {
        const country = this.configService.get<string>('country');
        const minister = this.configService.get<string>(
            'docGenerate.ministerName',
        );
        const ministry = this.configService.get<string>(
            'docGenerate.ministryName',
        );
        const fileName = `LETTER_OF_AUTHORISATION_${programmeId}.pdf`;
        const filePath = path.join(
            process.cwd(),
            'public',
            'documents',
            fileName,
        );
        const folderPath = path.dirname(filePath);

        // Ensure folder exists
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const date = new Date().toDateString();

        let orgName: string;
        if (orgs.length > 2) {
            orgName =
                orgs.slice(0, orgs.length - 1).join(', ') +
                ' and ' +
                orgs[orgs.length - 1];
        } else {
            orgName = orgs.join(' and ');
        }

        const doc = new PDFDocument();
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(11);

        // Use built‑in fonts (Helvetica) instead of custom fonts
        // Header: date and title
        doc.font('Helvetica-Bold').text(date, { align: 'right' });
        doc.text(`\n\nLetter of Authorisation of ${programmeName}`, {
            align: 'left',
        });

        // Use Helvetica-Bold for headings and Helvetica for body text
        doc.font('Helvetica-Bold').text('\n\nMandate For Authorisation', {
            underline: true,
        });
        doc.font('Helvetica');

        doc.text(
            `\n\n 1. The ${authorisedCompanyName} is the Government’s Ministry responsible for climate change in ${country}.`,
            { indent: 15 },
        );

        doc.text(
            `\n\n 2. The Government has mandated ${authorisedCompanyName} to oversee ${country}'s participation in Article 6.2 cooperative approach under the Paris Agreement and the relevant decisions adopted according to the United Nations Framework Convention on Climate Change (UNFCCC), particularly, Decision 2/CMA3.`,
            { indent: 15 },
        );

        doc.text(
            `\n\n 3. The Ministry of Environment, Forestry and Tourism is also the designated competent authority for implementing the “Cooperation Agreement between the ${orgName} and the ${country} towards the implementation of the Paris Agreement (hereinafter referred to as the Cooperation Agreement with ${orgName}).`,
            { indent: 15 },
        );

        doc.font('Helvetica-Bold').text(
            '\n\nPre-conditions for Authorisation ',
            { underline: true },
        );
        doc.font('Helvetica');

        doc.text(
            `\n\n 4. The ${orgName}, as the authorised mitigation activity participant for the “${programmeName}” (hereinafter referred to as the Mitigation Activity as defined in the Cooperation Agreement with ${orgName}):`,
            { indent: 15 },
        );

        doc.text(
            `\n\n 4.1 Having satisfied all the pre-conditions for authorising mitigation outcomes for international transfers and their subsequent use cases as set out in ${country}'s international carbon market framework and;`,
            { indent: 15 },
        );

        doc.text(
            `\n\n 4.2 Having considered the technical recommendations from ${country}'s carbon market task force on the ${programmeName}`,
            { indent: 15 },
        );

        doc.font('Helvetica-Bold').text('\n\nAuthorisation Statement', {
            underline: true,
        });
        doc.font('Helvetica');

        doc.text(
            `\n\n 5. The ${authorisedCompanyName} hereby grants formal Authorisation of the Internationally Transferred Mitigation Outcomes (ITMOs) that are generated from implementing the “${programmeName}” based on the information outlined in `,
            { indent: 15, continued: true },
        );
        doc.fillColor('black').text(`, the methodology in `, {
            indent: 15,
            continued: true,
        });
        doc.fillColor('black').text(
            `, and per the Article 6.3 of the Paris Agreement and the Cooperation Agreement with ${orgName}.`,
            { indent: 15 },
        );

        doc.font('Helvetica-Bold').text('\n\nImplications of Authorisation ', {
            underline: true,
        });
        doc.font('Helvetica');

        doc.text(`\n\n 6. By this letter, the ${country} confirms that: `, {
            indent: 15,
        });
        doc.text(
            `\n\n a. It ratified the Paris Agreement on April 2016 and maintains its latest NDC on the interim NDC registry under Article 4, paragraph 12 of the Paris Agreement.`,
            { indent: 30 },
        );
        doc.text(
            `\n\n b. Its participation in Article 6, paragraph 2, the cooperative approach of the Paris Agreement with the ${orgName} as the receiving Party, is voluntary.`,
            { indent: 30 },
        );
        doc.text(
            `\n\n c. Its commitment to transfer the number of issued mitigation outcomes arising from the implementation of the “${programmeName}” shall NOT prevent ${country} from achieving the 2030 NDC target.`,
            { indent: 30 },
        );

        doc.text(
            `\n\n 7. This letter constitutes ${country} authorisation, as defined per the guidance on cooperative approaches referred to in Article 6, paragraph 2, of the Paris Agreement (Decision 2/CMA.3) and ${country}'s International Carbon Market Framework for the Mitigation Activity, with the following: `,
            { indent: 15 },
        );
        doc.text(
            `\n\n a. ITMOs generated in respect of or representing mitigation from 2021 onward, spanning through the NDC implementation period up to 2030.`,
            { indent: 30 },
        );
        doc.text(
            `\n\n b. ITMOs generated from the Authorised mitigation activity will not be used by the ${country} to demonstrate the achievement of its own NDC;`,
            { indent: 30 },
        );
        doc.text(
            `\n\n c. Mitigation Outcomes from the Authorised mitigation activity will be recognised into ${country}'s registry, and the transfer and use of ITMOs are consistent with the guidance and relevant decisions of the CMA.`,
            { indent: 30 },
        );
        doc.text(
            `\n\n 8. This letter does not imply or provide a commitment on the part of the ${country} to support or fund the authorised mitigation activity if any parties have legal or environmental requirements for the construction and operation of the mitigation activity not fulfilled and the mitigation activity, therefore, is unable to proceed.`,
            { indent: 15 },
        );

        doc.moveDown(3);
        doc.font('Helvetica-Bold').text('\n\nConfirmations', {
            underline: true,
        });
        doc.font('Helvetica');

        doc.text(
            `\n\n 9. The ${country} commits to transfer the amount of authorised, verified and positively examined ITMOs from this mitigation activity under the Cooperation Agreement with ${orgName}, signed on ${date}.`,
            { indent: 15 },
        );
        doc.text(
            `\n\n 10. Through this letter, the ${country} confirms to follow all requirements of the Paris Agreement as well as the Cooperation Agreement with ${orgName}, including reporting, preventing double-counting and double-claiming, and undertaking Corresponding Adjustments.`,
            { indent: 15 },
        );
        doc.text(
            `\n\n 11. By this letter, the ${country} commits to apply corresponding adjustments (single-year target accounting approach by calculating average annual ITMOs transfers over 2021-2030), consistently with the guidance on cooperative approaches referred to in Article 6, paragraph 2, of the Paris Agreement (Decision 2/CMA.3) and relevant future decisions of the CMA, in a transparent, accurate, complete, comparable, and consistent manner.`,
            { indent: 15 },
        );

        doc.text(
            `\n\nSincerely,\nHonorable ${minister}\nMinister\n${ministry}\nGovernment of ${country}`,
        );

        doc.font('Helvetica-Bold').text('\n\nAppendices', { underline: true });
        doc.moveDown(2);
        doc.fillColor('black');

        doc.end();

        await new Promise<void>((resolve) => {
            stream.on('finish', resolve);
        });

        const content = fs.readFileSync(filePath, { encoding: 'base64' });
        const url = await this.fileHandler.uploadFile(
            `documents/${fileName}`,
            content,
        );
        return url;
    }
}
