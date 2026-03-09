require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
    console.log('User:', process.env.SMTP_USER);
    console.log('Host:', process.env.SMTP_HOST);

    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        debug: true,
        logger: true
    });

    try {
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Authentication Successful!');

        let info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: "Teste de SMTP",
            text: "Teste de envio de e-mail via Titan SMTP."
        });

        console.log("Message sent:", info.messageId);
    } catch (error) {
        console.error("Error during SMTP connection/sending:", error);
    }
}

test();
