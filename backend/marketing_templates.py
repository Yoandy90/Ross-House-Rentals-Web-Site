"""
Marketing Email Templates - HTML email templates for campaigns.
Used by the marketing routes for sending bulk campaigns.
"""

# ================== MARKETING EMAIL TEMPLATES ==================

MARKETING_EMAIL_TEMPLATES = {
    "cita_pendiente": {
        "subject": "Tu reembolso te está esperando — ¿Agendamos tu cita?",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">💰 Tu Reembolso Te Espera</h1>
            </div>
            <div style="padding: 30px; color: #333;">
                <p style="font-size: 16px;">Hola <strong>{nombre}</strong>,</p>
                
                <p style="font-size: 15px; line-height: 1.6;">¿Sabías que muchos contribuyentes dejan dinero sobre la mesa cada año? Si aún no has presentado tus impuestos de este año, es el momento perfecto para hacerlo.</p>
                
                <p style="font-size: 15px; line-height: 1.6;">En Ross Tax Preparation nos especializamos en encontrar cada deducción y crédito que te corresponde — desde el Crédito por Ingreso del Trabajo (EITC) hasta deducciones por dependientes y gastos médicos.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">¿Por qué elegirnos?</h3>
                    <ul style="font-size: 14px; line-height: 1.8; color: #555;">
                        <li>✅ Atención personalizada en español e inglés</li>
                        <li>✅ Revisamos tu declaración del año pasado GRATIS para ver si dejaste dinero</li>
                        <li>✅ Opciones de pago flexibles</li>
                        <li>✅ Citas presenciales o por videollamada</li>
                    </ul>
                </div>
                
                <p style="font-size: 15px; line-height: 1.6;">No esperes a última hora.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://rosstaxpreparation.com/cita" style="background: #6C1110; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">📅 Reserva tu Cita Hoy</a>
                </div>
                
                <p style="font-size: 15px; line-height: 1.6;">Si tienes preguntas antes de venir, llámanos o escríbenos por WhatsApp al <strong>(806) 934-2018</strong> — estamos para ayudarte.</p>
                
                <p style="font-size: 15px; margin-top: 30px;">¡Te esperamos!<br><strong>Ross Tax Preparation</strong></p>
            </div>
            <div style="background: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                <p>Ross Tax Preparation</p>
                <p>📍 305 Bruce Ave, Dumas, TX 79029</p>
                <p>📞 (806) 934-2018 | ✉️ info@rosstaxpreparation.com</p>
            </div>
        </div>
        """
    },
    "consejos_impuestos": {
        "subject": "5 consejos para pagar menos impuestos el próximo año",
        "html": """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📚 Consejos para tus Impuestos</h1>
            </div>
            <div style="padding: 30px; color: #333;">
                <p style="font-size: 16px;">Hola <strong>{nombre}</strong>,</p>
                
                <p style="font-size: 15px; line-height: 1.6;">¡Gracias por confiar en Ross Tax Preparation para tus impuestos! Ahora que ya presentaste, queremos compartirte algunos consejos para que el próximo año sea aún mejor:</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">1. Guarda TODOS tus recibos desde nuestra app 📱</h3>
                    <p style="font-size: 14px; color: #555; margin-bottom: 0;">Gastos médicos, donaciones, materiales de trabajo... todo suma. Usa la app de Ross Tax para subirnos tus documentos durante el año y tenerlos listos cuando llegue la temporada de taxes.</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">2. Contribuye a una cuenta de retiro (IRA) 🏦</h3>
                    <p style="font-size: 14px; color: #555; margin-bottom: 0;">Las contribuciones a una IRA tradicional pueden reducir tu ingreso gravable. Tienes hasta abril del próximo año para contribuir.</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">3. Revisa tu retención de impuestos (W-4) 📋</h3>
                    <p style="font-size: 14px; color: #555; margin-bottom: 0;">Si recibiste un reembolso muy grande o debiste pagar, ajusta tu W-4 con tu empleador para equilibrar tus pagos.</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">4. Aprovecha los créditos educativos 🎓</h3>
                    <p style="font-size: 14px; color: #555; margin-bottom: 0;">Si tú o tus hijos estudian, el Crédito de Oportunidad Americana puede darte hasta $2,500 por estudiante.</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">5. Mantén registro de gastos de negocio 💼</h3>
                    <p style="font-size: 14px; color: #555; margin-bottom: 0;">Si tienes ingresos por cuenta propia (1099), cada gasto legítimo reduce lo que debes.</p>
                </div>
                
                <p style="font-size: 15px; line-height: 1.6;">¿Tienes dudas sobre alguno de estos puntos? Responde a este correo o escríbenos por WhatsApp al <strong>(806) 934-2018</strong> y te orientamos.</p>
                
                <p style="font-size: 15px; margin-top: 30px;">¡Nos vemos el próximo año!<br><strong>Ross Tax Preparation</strong></p>
            </div>
            <div style="background: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                <p>Ross Tax Preparation</p>
                <p>📍 305 Bruce Ave, Dumas, TX 79029</p>
                <p>📞 (806) 934-2018 | ✉️ info@rosstaxpreparation.com</p>
            </div>
        </div>
        """
    }
}

