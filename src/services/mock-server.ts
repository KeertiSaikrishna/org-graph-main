import { createServer, Model } from 'miragejs';

export function makeServer() {
  return createServer({
    models: {
      employee: Model,
    },

    seeds(server) {
      server.create('employee', { 
          id: '1', 
          name: 'Mark Hill', 
          designation: 'Chief Executive Officer',
          team: 'Executive',
          managerId: null
      });

      server.create('employee', { 
          id: '2', 
          name: 'Joe Linux', 
          designation: 'Chief Technology Officer',
          team: 'Technology',
          managerId: '1'
      });
      
      server.create('employee', { 
          id: '3', 
          name: 'Linda May', 
          designation: 'Chief Business Officer',
          team: 'Business',
          managerId: '1'
      });
      
      server.create('employee', { 
          id: '4', 
          name: 'John Green', 
          designation: 'Chief Financial Officer',
          team: 'Finance',
          managerId: '1'
      });
      
      server.create('employee', { 
          id: '5', 
          name: 'Ron Blomquist', 
          designation: 'VP of Engineering',
          team: 'Technology',
          managerId: '2'
      });
      
      server.create('employee', { 
          id: '6', 
          name: 'Michael Rubin', 
          designation: 'VP of Product',
          team: 'Technology',
          managerId: '2'
      });
      
      server.create('employee', { 
          id: '7', 
          name: 'Alice Lopez', 
          designation: 'VP of Marketing',
          team: 'Business',
          managerId: '3'
      });
      
      server.create('employee', { 
          id: '8', 
          name: 'Mary Johnson', 
          designation: 'VP of Sales',
          team: 'Business',
          managerId: '3'
      });
      
      server.create('employee', { 
          id: '9', 
          name: 'Kirk Douglas', 
          designation: 'VP of Accounting',
          team: 'Finance',
          managerId: '4'
      });
      
      server.create('employee', { 
          id: '10', 
          name: 'Erica Reel', 
          designation: 'VP of Operations',
          team: 'Finance',
          managerId: '4'
      });
    },

    routes() {
      this.get('/api/employees', (schema) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(schema.all('employee'));
          }, 1000);
        });
      });

      this.patch('/api/employees/:id', (schema, request) => {
        const id = request.params.id;
        const attrs = JSON.parse(request.requestBody);
        const employee = schema.find('employee', id);
        if (employee) {
          employee.update(attrs);
          return employee;
        }
        return null;
      });
    },
  });
}