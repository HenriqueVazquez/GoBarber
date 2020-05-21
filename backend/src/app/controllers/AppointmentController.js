import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours} from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';

import CancellationMail from '../jobs/CancellationMail';
import Queue from '../../lib/Queue';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: {user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page -1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [{
            model: File,
            as: 'avatar',
            attributes: ['id', 'path', 'url'],
          },
        ],
        },
      ],
    });

    return res.json(appointments);
  }


  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if(!(await schema.isValid(req.body))) {
      return res.status(400).json({Erro: 'Erro na validação!'});

    }

    const { provider_id, date } = req.body;

    // Se o token informado é de usuario
    const isUser = await User.findOne({
      where: {id: req.userId, provider: false},
    });

    if(!isUser && req.userId === provider_id) {
      return res
      .status(401)
      .json({ Erro: 'Agendamento só pode ser realizado por usuário'});
    }

    //Verificar se provider_id é um provider

    const isProvider = await User.findOne({
      where: {id: provider_id, provider: true },
    });

    if(!isProvider) {
      return res
      .status(401)
      .json({ Erro: 'Agendamento só pode ser realizado com prestador de serviço'});
    }


    //verificando se a data que estamos tentando agendar já passou.

    const hourStart = startOfHour(parseISO(date));

    if(isBefore(hourStart, new Date())) {
      return res.status(400).json({Erro: 'Não é permitido agendar horários em datas passadas!'})
    }

    //checando se a data de agendamento esta disponivel
    const checkAvailability = await Appointment.findOne({
      where:{
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if(checkAvailability) {
      return res.status(400).json({ Erro: 'Data de agendamento não está disponivel!'});
    }


    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    //notificar prestador de serviço sobre agendamento
    const user = await User.findByPk(req.userId);
    const formatterdDate = format(
      hourStart,
      "'dia 'dd' de 'MMMM', às 'H:mm'h'",
      {
        locale: pt,
      }
    )

    await Notification.create({
      content: `novo agendamento de Henrique vazquez para ${formatterdDate}`,
      user: provider_id,
    });



    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include:[
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        }
      ],
    });

    if(appointment.user_id !== req.userId) {
      return res.status(401).json({
        Erro: "Você não tem permissão para realizar este cancelamento!",
      });
    }

    if(appointment.canceled_at !== null) {
      return res.status(401).json({
        Erro: "Este agendamento já esta cancelado!",
      });
    }


    const dateWithSub = subHours(appointment.date, 2);

    if(isBefore(dateWithSub, new Date())) {
      return res.status(401)
      .json({ Erro: 'Não é possivel cancelar agendamento com menos de duas horas de antecedência!',
    });
    }


    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment,
    });


    return res.json(appointment);
  }
}

export default new AppointmentController();
