import Bee from 'bee-queue';
import CancellationMail from '../app/jobs/CancellationMail';
import redisConfig from '../config/redis';

//adicionando jobs

const jobs = [ CancellationMail ];

//criando filas

class Queue {
  constructor() {
    this.queues = {};

    this.init();
  }
//armazenando na fila o bee que é nossa instancia que conecta com o redis
  init () {
    jobs.forEach(({ key, handle }) => {
      this.queues[key] =  {
        bee: new Bee(key, {
        redis: redisConfig,
      }),
      handle,
    };
    });
  }

    // adiciona job dentro da fila
  add(queue, job) {
    return this.queues[queue].bee.createJob(job).save();
  }

  //pega os jobs e processa em tempo real
  processQueue() {
    jobs.forEach(job => {
      const { bee, handle } = this.queues[job.key];

      bee.on('failed', this.handleFailure).process(handle);
    });
  }

  handleFailure(job, err) {
    console.log(`Queue ${job.queue.name}:  FAILED`, err);
  }
}

export default new Queue();
