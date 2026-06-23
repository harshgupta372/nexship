
pipeline {
  agent any

  environment {
    DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
    DOCKERHUB_USER        = "${DOCKERHUB_CREDENTIALS_USR}"
    SSH_KEY               = credentials('deploy-ssh-key')
    DEPLOY_HOST           = credentials('deploy-host')
    IMAGE_TAG             = "${env.BUILD_NUMBER}"
    // Cache mongodb-memory-server binary between Jenkins runs
    MONGOMS_DOWNLOAD_DIR  = "${env.WORKSPACE}/.mongo-binaries"
  }

  stages {

    // ── 1. TEST ───────────────────────────────────────────────────────────────
    // Run tests BEFORE building images — fail fast, don't waste build time.
    // Only auth-service and order-service have Jest suites right now.
    // Add a service here when its tests are written.
    stage('Test') {
      steps {
        script {
          def tested = ['auth-service', 'order-service']
          tested.each { svc ->
            dir("services/${svc}") {
              sh 'npm ci'
              sh 'NODE_ENV=test JWT_ACCESS_SECRET=ci-access-secret JWT_REFRESH_SECRET=ci-refresh-secret npm test -- --forceExit --ci'
            }
          }
        }
      }
      post {
        failure {
          error "Tests failed — deploy blocked. Fix failing tests before merging."
        }
      }
    }

    // ── 2. BUILD ──────────────────────────────────────────────────────────────
    // Only reached if all tests passed.
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

    // ── 3. PUSH ───────────────────────────────────────────────────────────────
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

    // ── 4. DEPLOY ─────────────────────────────────────────────────────────────
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
      sh "docker logout || true"
    }
    success {
      echo "NexShip deployed — build #${IMAGE_TAG}"
    }
    failure {
      echo "Pipeline failed — check stage logs above"
    }
  }
}
