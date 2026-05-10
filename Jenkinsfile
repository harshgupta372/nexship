
pipeline {
  agent any

  environment {
    DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
    DOCKERHUB_USER        = "${DOCKERHUB_CREDENTIALS_USR}"
    SSH_KEY               = credentials('deploy-ssh-key')
    DEPLOY_HOST           = credentials('deploy-host')
    IMAGE_TAG             = "${env.BUILD_NUMBER}"
  }

  stages {

    stage('Build') {
      steps {
        script {
          def services = ['auth-service', 'order-service', 'tracking-service', 'notification-service', 'analytics-service', 'gateway']
          services.each { svc ->
            def context = svc == 'gateway' ? './gateway' : "./services/${svc}"
            sh "docker build -t ${DOCKERHUB_USER}/nexship-${svc}:${IMAGE_TAG} ${context}"
          }
        }
      }
    }

    stage('Test') {
      steps {
        script {
          def services = ['auth-service', 'order-service', 'tracking-service', 'notification-service', 'analytics-service']
          services.each { svc ->
            sh """
              docker run --rm \
                -e NODE_ENV=test \
                ${DOCKERHUB_USER}/nexship-${svc}:${IMAGE_TAG} \
                npm test -- --coverage --forceExit
            """
          }
        }
      }
      post {
        failure {
          error "Tests failed — aborting pipeline"
        }
      }
    }

    stage('Push') {
      steps {
        sh "echo ${DOCKERHUB_CREDENTIALS_PSW} | docker login -u ${DOCKERHUB_USER} --password-stdin"
        script {
          def services = ['auth-service', 'order-service', 'tracking-service', 'notification-service', 'analytics-service', 'gateway']
          services.each { svc ->
            sh "docker push ${DOCKERHUB_USER}/nexship-${svc}:${IMAGE_TAG}"
            sh "docker tag  ${DOCKERHUB_USER}/nexship-${svc}:${IMAGE_TAG} ${DOCKERHUB_USER}/nexship-${svc}:latest"
            sh "docker push ${DOCKERHUB_USER}/nexship-${svc}:latest"
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        sh """
          ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ubuntu@${DEPLOY_HOST} '
            cd ~/nexship &&
            export IMAGE_TAG=${IMAGE_TAG} &&
            docker-compose pull &&
            docker-compose up -d --remove-orphans
          '
        """
      }
    }
  }

  post {
    always {
      sh "docker logout"
    }
    success {
      echo "NexShip deployment successful — build #${IMAGE_TAG}"
    }
    failure {
      echo "Pipeline failed — check logs above"
    }
  }
}
